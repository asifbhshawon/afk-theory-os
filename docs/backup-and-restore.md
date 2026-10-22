# Backup, Verification & Disaster Recovery Guide

**System Principle:** Docker volumes are persistent storage, NOT backups. True disaster recovery requires independent local copies on separate physical disks or external media.

---

## 1. Local Backup Strategy

The backup subsystem bundles:
1. **PostgreSQL Logical Dump:** Generated via `pg_dump` with transactional consistency.
2. **Local Documents Archive:** All attached vouchers, invoices, and design proofs in `./storage`.
3. **SHA-256 Integrity Manifest:** `manifest.json` recording backup ID, file size, timestamp, and SHA256 hashes of all components.

---

## 2. Generating a Backup

Run the PowerShell backup script:

```powershell
# Default destination (./backups):
.\scripts\backup.ps1

# External mounted drive (Recommended for physical safety):
.\scripts\backup.ps1 -Destination "E:\AFK-Backups"
```

Example Output:
```text
==========================================================
   AFK THEORY Business OS -- Local Backup Generator
==========================================================
Destination: .\backups\AFK-BACKUP-2026-10-23_00-12-22

[1/3] Exporting PostgreSQL logical dump...
[OK] Database dump created: 240.96 KB

[2/3] Archiving local documents and uploads...
[OK] Documents directory archived

[3/3] Generating SHA256 integrity manifest...
[OK] Integrity manifest written: .\backups\AFK-BACKUP-2026-10-23_00-12-22\manifest.json
  Database SHA256: AEAA16446AB333ADA0E602760E2961F10657341E95CE9CE8509DCA36A29EE91F
==========================================================
```

---

## 3. Verifying Backup Integrity

To verify that a backup has not suffered bit-rot or file corruption:

```powershell
.\scripts\verify-backup.ps1 -BackupPath ".\backups\AFK-BACKUP-2026-10-23_00-12-22"
```

The script recalculates the SHA-256 hash of `database.sql` and compares it to `manifest.json`.

---

## 4. Isolated Test Restore Drill (Acceptance Test 16)

Before ever touching live production, test restores must execute into a disposable database:

```powershell
.\scripts\restore.ps1 -BackupPath ".\backups\AFK-BACKUP-2026-10-23_00-12-22" -Isolated
```

This:
1. Creates disposable database `afk_restore_test`.
2. Restores all tables, constraints, sequences, and data rows.
3. Queries and verifies partner counts, accounts, and journal numbers.
4. Leaves the live database `afk_business_os` completely untouched.

---

## 5. Live Production Disaster Recovery

If the host PC suffered a failure and must be recovered from backup:

```powershell
# Perform live database replacement (takes a safety backup of current state first):
.\scripts\restore.ps1 -BackupPath "E:\AFK-Backups\AFK-BACKUP-..." -ForceLive
```
