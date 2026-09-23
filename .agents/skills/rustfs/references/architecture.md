# RustFS Architecture & Design Principles

When advising users on system architecture, hardware, and file systems, enforce the following RustFS best practices.

## 1. Storage Medium & Hardware

- **JBOD is Mandatory**: The official recommendation is to use **JBOD (Just a Bunch of Disks)**.
- **NO Hardware RAID**: Hardware RAID becomes a performance bottleneck. RustFS manages redundancy in software via Erasure Coding.
- **NO NFS**: **NFS is strictly prohibited** as the underlying storage medium due to phantom writes and locking issues under high I/O conditions.
- **Media**: NVMe SSDs are strongly recommended for high throughput.

## 2. File System (CRITICAL)

- **XFS is Strongly Recommended**: RustFS strongly recommends formatting all storage disks with `XFS`. Do not recommend `ext4`, `BTRFS`, or `ZFS`.
- **Format Command**: `mkfs.xfs -i size=512 -n ftype=1 -L RUSTFS0 /dev/sdb`
  - `-i size=512`: Optimizes inode size for small objects/metadata.
  - `-n ftype=1`: Speeds up `readdir` and `unlink` operations.
- **Mount Options**: `defaults,noatime,nodiratime`

## 3. Core Concepts

- **Decentralized**: No NameNodes or Metadata servers (unlike HDFS or Ceph). All nodes are completely symmetric.
- **Erasure Coding**: Uses Reed-Solomon Erasure Coding. In a standard N-drive cluster, read quorum is `N/2` and write quorum is `(N/2) + 1`.
- **Bitrot Protection**: Uses HighwayHash to detect and repair silent data corruption automatically.
- **Server-Side Encryption (SSE)**: Supports AES-256-GCM, ChaCha20-Poly1305. Compatible with external KMS like HashiCorp Vault.

## 4. Operational Limits

- **Max object size**: 5 TiB
- **Max parts per upload**: 10,000
- **Part size range**: 5 MiB to 5 GiB (last part can be 0 B)
- **Max length of bucket name**: 63 characters
