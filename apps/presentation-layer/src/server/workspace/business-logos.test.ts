import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_BUSINESS_LOGO_BYTES } from "@/entities/workspace/business-logo";
import { ApiError } from "@/shared/api/errors";
import { readBusinessLogoUpload, validateBusinessLogo } from "./business-logos";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMioAAAAASUVORK5CYII=",
  "base64",
);

function upload(file: File) {
  const body = new FormData();
  body.append("file", file);
  return new Request("http://localhost/api/business-logos", {
    method: "POST",
    body,
  });
}

function hasCode(code: string) {
  return (error: unknown) => error instanceof ApiError && error.code === code;
}

describe("business logo uploads", () => {
  it("accepts a PNG from a multipart request without Content-Length", async () => {
    const request = upload(
      new File([png], "company.png", { type: "image/png" }),
    );
    assert.equal(request.headers.get("content-length"), null);
    const result = await readBusinessLogoUpload(request);
    assert.equal(result.extension, "png");
    assert.equal(result.contentType, "image/png");
    assert.deepEqual(Buffer.from(result.bytes), png);
  });

  it("rejects SVG/HTML bytes disguised as a PNG", () => {
    assert.throws(
      () =>
        validateBusinessLogo(
          Buffer.from('<svg onload="alert(1)"/>'),
          "image/png",
        ),
      hasCode("INVALID_LOGO"),
    );
  });

  it("rejects a mismatched declared image format and truncated images", () => {
    assert.throws(
      () => validateBusinessLogo(png, "image/jpeg"),
      hasCode("INVALID_LOGO"),
    );
    assert.throws(
      () => validateBusinessLogo(png.subarray(0, 40), "image/png"),
      hasCode("INVALID_LOGO"),
    );
  });

  it("rejects files over 2 MB and empty files", async () => {
    await assert.rejects(
      readBusinessLogoUpload(
        upload(
          new File([new Uint8Array(MAX_BUSINESS_LOGO_BYTES + 1)], "large.png", {
            type: "image/png",
          }),
        ),
      ),
      hasCode("LOGO_TOO_LARGE"),
    );
    await assert.rejects(
      readBusinessLogoUpload(
        upload(new File([], "empty.png", { type: "image/png" })),
      ),
      hasCode("INVALID_LOGO"),
    );
  });

  it("bounds actual body bytes even without a trustworthy size header", async () => {
    const request = new Request("http://localhost/api/business-logos", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=test",
        "content-length": "1",
      },
      body: new Uint8Array(MAX_BUSINESS_LOGO_BYTES + 16 * 1024 + 1),
    });
    await assert.rejects(
      readBusinessLogoUpload(request),
      hasCode("LOGO_TOO_LARGE"),
    );
  });

  it("requires exactly one file", async () => {
    const form = new FormData();
    form.append("file", new File([png], "one.png", { type: "image/png" }));
    form.append("file", new File([png], "two.png", { type: "image/png" }));
    await assert.rejects(
      readBusinessLogoUpload(
        new Request("http://localhost/api/business-logos", {
          method: "POST",
          body: form,
        }),
      ),
      hasCode("FILE_REQUIRED"),
    );
    await assert.rejects(
      readBusinessLogoUpload(
        new Request("http://localhost/api/business-logos", {
          method: "POST",
          body: "hello",
        }),
      ),
      hasCode("FILE_REQUIRED"),
    );
  });
});
