# Backup, Verification & Disaster Recovery Guide

**System Principle:** Docker volumes are persistent storage, NOT backups. True disaster recovery requires independent local copies on separate physical disks or external media with authenticated encryption.

---

## 1. Local Backup Strategy

The backup subsystem bundles:
1. **PostgreSQL Logical Dump:** Generated via `pg_dump` with transactional consistency.
2. **AES-256-GCM Authenticated Encryption:** Encrypted using a PBKDF2/scrypt derived key and authenticated with a 16-byte GCM authentication tag, defending against both tampering and unauthorized inspection.
3. **Local Documents Archive:** All attached vouchers, invoices, and design proofs in `./storage`.
4. **Integrity Manifest:** `manifest.json` recording backup ID, encrypted and unencrypted file sizes, timestamps, auth tags, and SHA-256 digests.
5. **Rotation & Retention:** Automatic pruning keeping the most recent N backups (defaults to 7).

---

## 2. Generating a Backup

Run the PowerShell backup script:

```powershell
# Default destination (./backups):
.\scripts\backup.ps1

# Custom external mounted drive with retention rotation:
.\scripts\backup.ps1 -Destination "E:\AFK-Backups" -KeepCount 7
```

Example Output:
```text
==========================================================
   AFK THEORY Business OS -- Authenticated Backup
==========================================================
Target Container: afk-theory-postgres
Destination:      .\backups\AFK-BACKUP-2026-10-23_01-50-40

[1/4] Exporting PostgreSQL logical dump...
[OK] Database dump created: 986.22 KB (SHA256: EF5A2461E7A5...)

[2/4] Applying AES-256-GCM authenticated encryption...
[OK] Dump encrypted with AES-256-GCM (AuthTag: 8d2bac5f731a...)

[3/4] Archiving local documents and uploads...
[OK] Documents directory archived (0 files)

[4/4] Generating authenticated integrity manifest...
[OK] Manifest generated: .\backups\AFK-BACKUP-2026-10-23_01-50-40\manifest.json

==========================================================
 Authenticated backup successful: .\backups\AFK-BACKUP-2026-10-23_01-50-40
 Verify with: .\scripts\verify-backup.ps1 -BackupPath ".\backups\AFK-BACKUP-2026-10-23_01-50-40"
==========================================================
```

---

## 3. Verifying Backup Integrity

To verify that a backup has not suffered bit-rot or file corruption:

```powershell
.\scripts\verify-backup.ps1 -BackupPath ".\backups\AFK-BACKUP-2026-10-23_01-50-40"
```

The script decrypts the ciphertext using Node.js crypto, validates the 16-byte AES-256-GCM auth tag, and compares the resulting stream SHA-256 hash to `manifest.json`.

---

## 4. Isolated Test Restore Drill (Acceptance Test 16)

Before ever touching live production, test restores must execute into a disposable database:

```powershell
.\scripts\restore.ps1 -BackupPath ".\backups\AFK-BACKUP-2026-10-23_01-50-40" -Isolated
```

This:
1. Validates the AES-256-GCM authentication tag.
2. Creates disposable database `afk_restore_test`.
3. Restores all tables, constraints, sequences, and data rows.
4. Queries and verifies partner counts, accounts, inventory lots, and journal numbers.
5. Destroys decrypted plaintexts and leaves live database `afk_business_os` completely untouched.

---

## 5. Live Production Disaster Recovery

If the host PC suffered a failure and must be recovered from backup:

```powershell
# Perform live database replacement (takes a safety backup of current state first):
.\scripts\restore.ps1 -BackupPath "E:\AFK-Backups\AFK-BACKUP-..." -ForceLive
```
