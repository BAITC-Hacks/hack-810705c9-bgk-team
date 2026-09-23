import { randomUUID } from "node:crypto";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { MAX_BUSINESS_LOGO_BYTES } from "@/entities/workspace/business-logo";
import { businessLogoKeySchema } from "@/entities/workspace/contracts";
import { ApiError } from "@/shared/api/errors";

const BUCKET = "task-match-assets";
const PREFIX = "business-logos/";
const MAX_MULTIPART_BYTES = MAX_BUSINESS_LOGO_BYTES + 16 * 1024;
let client: S3Client | undefined;
let bucketReady: Promise<void> | undefined;

function storage() {
  return (client ??= new S3Client({
    endpoint: process.env.RUSTFS_ENDPOINT || "http://localhost:9000",
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.RUSTFS_ACCESS_KEY || "rustfsadmin",
      secretAccessKey: process.env.RUSTFS_SECRET_KEY || "rustfsadmin",
    },
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 3_000, socketTimeout: 10_000 },
  }));
}

function storageStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("$metadata" in error))
    return undefined;
  return (error.$metadata as { httpStatusCode?: number })?.httpStatusCode;
}

async function ensureBucket() {
  bucketReady ??= (async () => {
    try {
      await storage().send(new HeadBucketCommand({ Bucket: BUCKET }));
    } catch (error) {
      if (storageStatus(error) !== 404) throw error;
      try {
        await storage().send(new CreateBucketCommand({ Bucket: BUCKET }));
      } catch (creationError) {
        if (
          !(creationError instanceof Error) ||
          creationError.name !== "BucketAlreadyOwnedByYou"
        )
          throw creationError;
      }
    }
  })().catch((error) => {
    bucketReady = undefined;
    throw error;
  });
  return bucketReady;
}

function invalidImage() {
  return new ApiError(
    422,
    "INVALID_LOGO",
    "Выберите изображение PNG, JPEG или WebP размером до 2 МБ.",
  );
}

export function validateBusinessLogo(bytes: Uint8Array, contentType: string) {
  if (bytes.byteLength > MAX_BUSINESS_LOGO_BYTES)
    throw new ApiError(
      413,
      "LOGO_TOO_LARGE",
      "Логотип должен быть не больше 2 МБ.",
    );
  const data = Buffer.from(bytes);
  let format: {
    extension: "png" | "jpg" | "webp";
    contentType: string;
  } | null = null;
  if (
    data.length >= 45 &&
    data
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    data.readUInt32BE(8) === 13 &&
    data.toString("ascii", 12, 16) === "IHDR" &&
    data.readUInt32BE(16) > 0 &&
    data.readUInt32BE(20) > 0 &&
    data.toString("ascii", data.length - 8, data.length - 4) === "IEND"
  )
    format = { extension: "png", contentType: "image/png" };
  else if (
    data.length > 4 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff &&
    data[data.length - 2] === 0xff &&
    data[data.length - 1] === 0xd9
  )
    format = { extension: "jpg", contentType: "image/jpeg" };
  else if (
    data.length >= 20 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.readUInt32LE(4) + 8 === data.length &&
    data.toString("ascii", 8, 12) === "WEBP" &&
    ["VP8 ", "VP8L", "VP8X"].includes(data.toString("ascii", 12, 16))
  )
    format = { extension: "webp", contentType: "image/webp" };
  if (!format || format.contentType !== contentType.toLowerCase())
    throw invalidImage();
  return format;
}

/** Bound the actual request stream, including requests without Content-Length. */
export async function readBusinessLogoUpload(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;"))
    throw new ApiError(415, "FILE_REQUIRED", "Прикрепите файл логотипа.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_MULTIPART_BYTES)
    throw new ApiError(
      413,
      "LOGO_TOO_LARGE",
      "Логотип должен быть не больше 2 МБ.",
    );
  const reader = request.body?.getReader();
  if (!reader) throw invalidImage();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        throw new ApiError(
          413,
          "LOGO_TOO_LARGE",
          "Логотип должен быть не больше 2 МБ.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new ApiError(
      400,
      "INVALID_UPLOAD",
      "Не удалось прочитать файл. Выберите его заново.",
    );
  }
  const file = form.get("file");
  if (!(file instanceof File) || form.getAll("file").length !== 1)
    throw new ApiError(400, "FILE_REQUIRED", "Прикрепите один файл логотипа.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { bytes, ...validateBusinessLogo(bytes, file.type) };
}

export async function uploadBusinessLogo(request: Request) {
  const { bytes, extension, contentType } =
    await readBusinessLogoUpload(request);
  const key = `${randomUUID()}.${extension}`;
  try {
    await ensureBucket();
    await storage().send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${PREFIX}${key}`,
        Body: bytes,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch {
    throw new ApiError(
      503,
      "LOGO_STORAGE_UNAVAILABLE",
      "Не удалось загрузить логотип. Попробуйте ещё раз или продолжите без него.",
    );
  }
  return { key, url: `/api/business-logos/${key}` };
}

export async function validateBusinessLogoKey(key: string): Promise<void> {
  const parsed = businessLogoKeySchema.safeParse(key);
  if (!parsed.success)
    throw new ApiError(
      422,
      "LOGO_NOT_FOUND",
      "Загрузите логотип заново или продолжите без него.",
    );
  try {
    await storage().send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: `${PREFIX}${parsed.data}` }),
    );
  } catch (error) {
    if (storageStatus(error) === 404)
      throw new ApiError(
        422,
        "LOGO_NOT_FOUND",
        "Загрузите логотип заново или продолжите без него.",
      );
    throw new ApiError(
      503,
      "LOGO_STORAGE_UNAVAILABLE",
      "Не удалось проверить логотип. Попробуйте ещё раз или продолжите без него.",
    );
  }
}

export async function getBusinessLogo(id: string) {
  const parsed = businessLogoKeySchema.safeParse(id);
  if (!parsed.success)
    throw new ApiError(404, "LOGO_NOT_FOUND", "Логотип не найден.");
  try {
    const object = await storage().send(
      new GetObjectCommand({ Bucket: BUCKET, Key: `${PREFIX}${parsed.data}` }),
    );
    if (!object.Body)
      throw new ApiError(404, "LOGO_NOT_FOUND", "Логотип не найден.");
    const bytes = await object.Body.transformToByteArray();
    const contentType = object.ContentType ?? "";
    validateBusinessLogo(bytes, contentType);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${parsed.data}"`,
        "X-Content-Type-Options": "nosniff",
        ...(object.ETag ? { ETag: object.ETag } : {}),
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (storageStatus(error) === 404)
      throw new ApiError(404, "LOGO_NOT_FOUND", "Логотип не найден.");
    throw new ApiError(
      503,
      "LOGO_STORAGE_UNAVAILABLE",
      "Не удалось загрузить логотип. Попробуйте ещё раз.",
    );
  }
}
