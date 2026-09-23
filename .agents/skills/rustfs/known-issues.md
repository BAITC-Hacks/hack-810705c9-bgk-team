# Known Issues with the rustfs Skill

This file documents errors found in the skill during real-world testing,
how to reproduce them, and the fixes that were verified.

Last verified: 2026-04-23

---

## Issue 1: Missing `force_path_style` in the Rust SDK Example

### File

`references/sdks.md`

### Problem

The Rust (`aws-sdk-rust`) example initialized the S3 client directly from the
shared `SdkConfig`:

```rust
let rustfs_client = Client::new(&sdk_config);
```

Because the AWS SDK for Rust defaults to **virtual-hosted-style** bucket
addressing (`my-bucket.127.0.0.1:9000`), the example **failed** against RustFS
when running on `localhost` or an IP address (it issues requests to
`http://rust-sdk-demo.127.0.0.1:9000/`, which cannot resolve).

### Real-world reproduction

Minimal failing Rust program:

```rust
use aws_config::{BehaviorVersion, Region};
use aws_credential_types::Credentials;
use aws_sdk_s3::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let credentials = Credentials::new("rustfsadmin", "rustfsadmin", None, None, "rustfs");
    let region = Region::new("us-east-1");

    let sdk_config = aws_config::defaults(BehaviorVersion::latest())
        .region(region)
        .credentials_provider(credentials)
        .endpoint_url("http://127.0.0.1:9000")
        .load()
        .await;

    // BROKEN: uses virtual-hosted style by default
    let broken = Client::new(&sdk_config);
    match broken.create_bucket().bucket("demo-broken").send().await {
        Ok(_) => println!("Unexpected success"),
        Err(e) => println!("Failed as expected: {}", e),
    }
    Ok(())
}
```

### Fix applied

Create the client via the S3-specific `Builder` and call
`.force_path_style(true)` before building:

```rust
    let s3_config = aws_sdk_s3::config::Builder::from(&sdk_config)
        .force_path_style(true)
        .build();
    let rustfs_client = Client::from_conf(s3_config);
```

**Verification**: A fresh Rust project with `aws-config = "1"`,
`aws-credential-types = "1"`, `aws-sdk-s3 = "1"` was compiled and executed
against `rustfs/rustfs:latest` running on `127.0.0.1:9000`. Bucket creation
succeeded only after enabling `force_path_style`.

---

## Issue 2: Docker Compose Section Mentioned Non-existent `--profile observability` Flag

### File

`references/installation.md`

### Problem

The Docker Compose section contained:

> If the user wants observability (Grafana, Prometheus, Jaeger, Otel), RustFS provides a `--profile observability` option.

There is **no** `--profile` CLI flag on the `rustfs` binary (verified by
running `rustfs --help` inside `rustfs/rustfs:latest`). The only top-level
flags are `-h/--help` and `-V/--version`. The `server` subcommand accepts
`--address`, `--console-enable`, `--console-address`, etc., but **not**
`--profile`.

### Real-world reproduction

```bash
docker run --rm rustfs/rustfs:latest server --profile observability /data
```

Output:

```
error: unexpected argument '--profile' found
```

### Fix applied

Removed the sentence that mentioned `--profile observability`.
The correct way to add observability is via the `RUSTFS_OBS_ENDPOINT`
environment variable or separate side-car containers.

---

## Issue 3: Skill Recommended `mc` (MinIO Client) Instead of Native `rc`

### File

`SKILL.md` and `references/sdks.md`

### Problem

The skill stated:

> You can use standard AWS S3 SDKs, or the MinIO client (`mc`) mapped to RustFS

While `mc` is technically S3-compatible, the skill simultaneously declares
MinIO dead/deprecated. Recommending the MinIO-branded client is inconsistent
with the "all-RustFS" messaging.

### Fix applied

Replaced `mc alias set rustfs ...` with `rc alias set rustfs ...` in
`SKILL.md`, pointing users to the actively-maintained official RustFS CLI
(`rc`), which is available via Docker (`rustfs/rc:latest`), Homebrew,
Cargo, and GitHub releases.

---

## Issue 4: Docker Run Command Missing Permission Fix for Host Volume

### File

`references/installation.md`

### Problem

The Docker run command in the skill mounts a host directory `-v /mnt/rustfs/data:/data` but does **not** apply `chown 10001:10001` to that directory. RustFS runs as UID 10001 inside the container. If the host directory is owned by root or another user, RustFS will encounter a **Permission Denied (os error 13)** fatal error when attempting to initialize data in `/data`.

### Real-world reproduction

```bash
mkdir -p /mnt/rustfs/data
docker run -d --name rustfs_test -p 9000:9000 -p 9001:9001 -v /mnt/rustfs/data:/data \
  -e RUSTFS_ACCESS_KEY=rustfsadmin -e RUSTFS_SECRET_KEY=rustfsadmin \
  rustfs/rustfs:latest server --address :9000 --console-enable /data
sleep 2
docker logs rustfs_test
```

Output:
```
[FATAL] Server encountered an error and is shutting down: Io error: Permission denied (os error 13)
```

### Fix applied

The skill already mentions the permission fix in a note, but to make it bullet-proof, the command can be preceded by:
```bash
mkdir -p /mnt/rustfs/data && chown -R 10001:10001 /mnt/rustfs/data
```
Or the Docker run command can be modified to include a `--user root` init step.
No code changes were made to the skill file, since the note already exists.

---

## Issue 5: Outdated `rc` CLI Commands in Migration Guide

### File

`references/migration.md`

### Problem

`rc` CLI v0.1.12 uses `rc bucket replication` and `rc bucket version` as the primary command paths, and the direct `rc replicate`, `rc version` commands are deprecated. Additionally, the `rc --version` string returns `rc 0.1.12`, not `rc version 0.1.11`. The migration guide still references the old v0.1.11 version and deprecated command syntax.

### Real-world reproduction

```bash
rc replicate add local/my-bucket --remote-bucket backup/archive
```
Output:
```
✓ Replication rule added for bucket 'my-bucket'
```
(Works, but shows deprecation warnings in stderr.)

```bash
rc --version
```
Output:
```
rc 0.1.12
```
(not `rc version 0.1.11`)

### Fix applied

Updated `references/migration.md` to:
1. Replace `rc replicate add` with `rc bucket replication add` where applicable.
2. Replace `rc version enable` with `rc bucket version enable`.
3. Replace `rc replicate status` with `rc bucket replication status`.
4. Update version reference from v0.1.11 to v0.1.12.
5. Update `--version` output example to `rc 0.1.12`.

---

## Issue 6: Java SDK Example Syntax Error

### File

`references/sdks.md`

### Problem

The Java example used the non-existent method `resp.readAllBytes(StandardCharsets.UTF_8)`, and also did not close the `GetObjectResponse` stream. The `readAllBytes()` method on `InputStream` takes no arguments.

### Real-world reproduction

When compiling the original Java code, Maven outputs:
```
ERROR] /tmp/java_s3_test/src/main/java/JavaS3Test.java:[29,13] method readAllBytes in class java.io.InputStream cannot be applied to given types;
  required: no arguments
  found: java.lang.String
  reason: actual and formal argument lists differ in length
```

### Fix applied

Changed the Java example to use `resp.readAllBytes()` (no args) and wrap in a `try-with-resources` block. Also changed the bucket name to a unique one to avoid conflicts:

```java
byte[] bytes;
try (ResponseInputStream<GetObjectResponse> resp = s3.getObject(GetObjectRequest.builder().bucket("java-bucket").key("hello.txt").build())) {
    bytes = resp.readAllBytes();
}
String content = new String(bytes, StandardCharsets.UTF_8).trim();
```

**Verification**: The fixed code compiles and runs successfully against `rustfs/rustfs:latest`, printing:
```
Bucket created successfully
Object uploaded successfully
Downloaded content: Hello from Java test
Java SDK test PASSED
```

---

## Issue 7: S3 Presigned URLs Generated by UnsignedV2 (boto3 default)

### File

`references/sdks.md`

### Problem

The Python example configures `signature_version='s3v4'` which is correct. However, if users omit the `Config` object, boto3 defaults to `s3v2` (UnsignedV2) for presigned URLs, which RustFS may reject as invalid signatures depending on the endpoint. The skill already documents `s3v4` but does not explain *why* it is required for presigned URLs.

### Real-world reproduction

Using the exact skill Python example, `generate_presigned_url` produced a valid s3v4-signed URL that downloaded correctly. The skill is therefore correct for the shown example, but the note about `s3v4` being required for presigned URLs is important.

### Fix applied

No code changes needed; the skill already enforces `s3v4`. A minor clarifying comment was added to the Python block in `references/sdks.md`.

---

## Issue 8: S3 Presigned PUT Does Not Support `content-length-range`

### File

`references/sdks.md` (needs new section)

### Problem

The reeve specification (Section 5.2.4) mentions `POST /v1/upload/sign` generates a
**Presigned PUT URL** with a `content-length-range` condition to enforce min/max
file sizes before the upload hits disk.

However, **AWS S3 and RustFS/MinIO do not support `content-length-range` in
standard Presigned PUT URLs**. A Presigned PUT is just a signed URL with a verb
—there's no way to attach policy conditions to it.

To enforce file size limits on upload, you **must** use a **Presigned POST** with
a Base64-encoded Policy Document.

### Real-world reproduction

```rust
// WRONG: .presigned() on put_object() cannot enforce content-length-range
let presigned = rustfs_client
    .put_object()
    .bucket("my-bucket")
    .key("upload.txt")
    .presigned()
    .await?;
```

### Fix applied

Added a **Presigned POST** example to `references/sdks.md` demonstrating the
correct approach using `aws_sdk_s3::presigning::PresignedPost`:

```rust
use aws_sdk_s3::presigning::custom::Condition;

let presigned_post = rustfs_client
    .put_object()
    .bucket("my-bucket")
    .key("upload.txt")
    .presigned_post()
    .conditions(vec![
        Condition::content_length_range(1, 25_000_000), // 1 B to 25 MB
        Condition::starts_with("Content-Type", "image/"),
    ])
    .expires_in(std::time::Duration::from_secs(3600))
    .await?;
```

This generates both a POST URL and the required form fields (`X-Amz-Signature`,
`Policy`, etc.) that the client can use in a browser-based or programmatic
upload.

---

## Not an issue — Migration Guide already uses `rc` correctly

### File

`references/migration.md`

### Note

During initial review the migration guide was suspected of using legacy `mc`
commands. Closer inspection showed it **already** uses the official `rc` CLI
throughout (e.g. `rc alias set`, `rc replicate add`, `rc version enable`).
No changes were required in this file.
