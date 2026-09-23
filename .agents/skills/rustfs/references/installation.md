# RustFS Installation & Deployment

## 1. Docker Deployment (SNSD - Single Node Single Disk)

For local testing or small workloads.

**Important Permission Note**: The RustFS container runs as the non-root user `rustfs` with UID `10001`. If mounting a host directory via `-v`, the host directory must be owned by `10001:10001` (e.g., `chown -R 10001:10001 /mnt/rustfs/data`), otherwise a "permission denied" error will occur.

```bash
docker run -d \
  --name rustfs_local \
  -p 9000:9000 \
  -p 9001:9001 \
  -v /mnt/rustfs/data:/data \
  -e RUSTFS_ACCESS_KEY=rustfsadmin \
  -e RUSTFS_SECRET_KEY=rustfsadmin \
  -e RUSTFS_CONSOLE_ENABLE=true \
  rustfs/rustfs:latest \
  --address :9000 \
  --console-enable \
  /data
```

## 2. Docker Compose

```yaml
services:
  rustfs_perms:
    image: alpine
    user: root
    volumes:
      - ./data:/fix_path
    command: chown -R 10001:10001 /fix_path

  rustfs:
    image: rustfs/rustfs:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - ./data:/data
    environment:
      - RUSTFS_ACCESS_KEY=rustfsadmin
      - RUSTFS_SECRET_KEY=rustfsadmin
      - RUSTFS_CONSOLE_ENABLE=true
    command: server --address :9000 --console-enable /data
    depends_on:
      rustfs_perms:
        condition: service_completed_successfully
```

## 3. Linux Bare Metal (Quick Start)

```bash
curl -O https://rustfs.com/install_rustfs.sh && bash install_rustfs.sh
```

## 4. Linux Bare Metal (Manual Binary)

```bash
wget https://dl.rustfs.com/artifacts/rustfs/release/rustfs-linux-x86_64-musl-latest.zip
unzip rustfs-linux-x86_64-musl-latest.zip
chmod +x rustfs
sudo mv rustfs /usr/local/bin/
```

**Environment File (`/etc/default/rustfs`)**:

```text
RUSTFS_ACCESS_KEY=rustfsadmin
RUSTFS_SECRET_KEY=rustfsadmin
# SNSD: RUSTFS_VOLUMES="/data/rustfs0"
# MNMD: RUSTFS_VOLUMES="http://node{1...4}:9000/data/rustfs{0...3}"
RUSTFS_ADDRESS=":9000"
RUSTFS_CONSOLE_ENABLE=true
```
