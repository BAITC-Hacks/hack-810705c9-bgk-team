# Safe Zero-Downtime Migration Guide: AWS S3 ↔ RustFS ↔ RustFS

RustFS is a high-performance, fully S3-compatible object storage system written in Rust.  
All migrations below achieve **true zero downtime** thanks to versioning + initial sync + continuous replication + atomic endpoint cutover.

**Key Principles for Zero Downtime**

- Enable **versioning** on source and destination buckets **before** starting.
- Run an **initial full sync** while applications keep writing to the source.
- Set up **continuous sync** (or native replication) for new/changed objects.
- Use dual-write (if your app supports it) or a short read/write cutover window.
- Switch application endpoints via DNS/config update (instant).
- Verify with checksums and monitor live traffic for 24–48 hours before decommissioning the old storage.

**Recommended Tools**

- **`rclone`** – Primary tool for all S3↔S3 syncs (independent, actively maintained, excellent checksum & bisync support).
- **`rc`** – Official RustFS CLI (for native replication on RustFS clusters).
- AWS CLI (only for AWS-side operations).

---

## Installing the Official RustFS CLI (`rc`)

**Repository**: https://github.com/rustfs/cli

**Installation (choose one):**

```bash
# 1. Direct binary (recommended)
# Go to: https://github.com/rustfs/cli/releases/tag/v0.1.12
# Download the correct binary for your OS/architecture

# 2. Homebrew (macOS / Linux)
brew install rustfs/tap/rc

# 3. Cargo
cargo install rustfs-cli

# 4. Docker
docker run --rm rustfs/rc:v0.1.12 --help
```

**Verify**:

```bash
rc --version
# → rc 0.1.12
```

---

## 1. AWS S3 → RustFS (Zero Downtime)

### Prerequisites

- Versioning enabled on AWS S3 bucket and RustFS bucket.

### Steps

1. **Configure rclone remotes**

   ```bash
   rclone config create aws s3
   rclone config create rustfs s3 \
     endpoint https://your-rustfs.example.com \
     access_key_id YOUR_RUSTFS_KEY \
     secret_access_key YOUR_RUSTFS_SECRET
   ```

2. **Initial full sync** (runs in background – no downtime)

   ```bash
   rclone sync aws:SOURCE-BUCKET rustfs:DEST-BUCKET \
     --checksum --fast-list --transfers 128 --checkers 64 --progress
   ```

3. **Continuous synchronization**
   Use `rclone bisync` (recommended) or cron job every 5–15 minutes:

   ```bash
   rclone bisync aws:SOURCE-BUCKET rustfs:DEST-BUCKET \
     --compare-size --checksum --resync
   ```

4. **Cutover**
   - Update application config / DNS / load-balancer to point to RustFS endpoint.
   - Optional: enable dual-write briefly if your application supports it.
   - Monitor lag with `rclone check` until zero.

5. **Verification**
   ```bash
   rclone check aws:SOURCE-BUCKET rustfs:DEST-BUCKET --size-only --checksum
   ```

---

## 2. RustFS → AWS S3 (Zero Downtime)

### Steps

1. **Configure remotes** (swap source/destination from above).

2. **Initial seed** (existing objects)

   ```bash
   rclone sync rustfs:SOURCE-BUCKET aws:DEST-BUCKET --checksum --fast-list
   ```

3. **Native replication with `rc` CLI** (recommended for ongoing changes)

   ```bash
   rc alias set aws https://s3.amazonaws.com AWS_ACCESS_KEY AWS_SECRET_KEY

    rc bucket replication add rustfs/my-bucket \
      --remote-bucket aws/target-bucket \
      --priority 1 \
      --replicate delete,delete-marker,existing-objects
    ```

4. **Monitor replication**

   ```bash
    rc bucket replication status rustfs/my-bucket
    ```

5. **Cutover & Verification**
   - Point applications to AWS S3.
   - Run final check:
     ```bash
     rclone check rustfs:SOURCE-BUCKET aws:DEST-BUCKET --size-only --checksum
     ```

---

## 3. RustFS → RustFS (Zero Downtime – Cluster/DC/Upgrade Migration)

### Steps

1. **Set target alias**

   ```bash
   rc alias set target https://target-rustfs.example.com TARGET_ACCESS_KEY TARGET_SECRET_KEY
   ```

2. **Enable versioning on both**

   ```bash
    rc bucket version enable source/my-bucket
    rc bucket version enable target/dest-bucket
   ```

3. **Native replication**

   ```bash
    rc bucket replication add source/my-bucket \
      --remote-bucket target/dest-bucket \
      --priority 1 \
      --replicate delete,delete-marker,existing-objects
    ```

4. **Initial seed of existing objects**

   ```bash
   rclone sync source-rustfs:SOURCE-BUCKET target-rustfs:DEST-BUCKET --checksum
   ```

5. **Active-Active Cutover**
   - Both clusters accept writes during transition.
   - Update application endpoints / DNS / service mesh.
    - Monitor: `rc bucket replication status source/my-bucket`
    - Once traffic is fully migrated and lag = 0, remove rule:
      ```bash
      rc bucket replication remove source/my-bucket --id <rule-id>
      ```

6. **Final verification**
   ```bash
   rclone check source-rustfs:BUCKET target-rustfs:BUCKET --size-only --checksum
   ```

---

## Best Practices & Troubleshooting

- Always use `--checksum` with rclone.
- Monitor replication lag via `rc bucket replication status`.
- Keep source storage online until 48 hours of stable production traffic on destination.
- Test the entire procedure on a non-production bucket first.
- rclone installation: `curl https://rclone.org/install.sh | sudo bash`
