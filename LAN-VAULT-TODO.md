# LAN Vault — TODO

Self-hosted password vault on a dedicated always-on machine at home.
Encrypted vault file synced to Mac, Windows, and Linux clients.

**Status:** planning. Nothing installed yet — this Mac is a clean slate.

---

## Decided

- [ ] **Vault format:** KeePass KDBX 4.1 — open standard, clients on every OS, no vendor lock-in
- [ ] **Crypto:** AES-256 cipher + Argon2id KDF, 1 GB memory, parallelism 8
      (all target machines are 8 GB+; no iOS device to constrain memory use)
- [ ] **Clients:** Mac, Windows, Linux — no iOS
- [ ] **Storage location:** dedicated machine on the LAN, not a cloud provider
- [ ] **Accepted risk:** all copies live in one building. Same exposure as the
      current HDD setup, and the encrypted vault means stolen hardware yields
      an unreadable blob. Not treating off-site backup as a blocker.

## Open decisions

- [ ] **Hardware** — buy off the shelf or configure my own
  - Raspberry Pi 5 + NVMe (~$150) — tiny, ~5 W, enough for sync alone
  - Used mini PC, ThinkCentre/OptiPlex Tiny (~$120) — best value, runs Debian + Docker
  - New N100/N150 mini PC (~$200) — same, new with warranty
  - Off-the-shelf NAS (~$300–500) — polished, hot-swap bays; check drive
    compatibility before buying, Synology restricts validated drives on recent models
  - DIY NAS build (~$400+) — only worth it for bulk storage beyond the vault
  - *Deciding factor: what else this box will do. For the vault alone, all are overkill.*
- [ ] **Sync software** — independent of hardware, decide after
  - Syncthing — peer-to-peer, no server component, needs the always-on node to be useful
  - Nextcloud — heavier, WebDAV, real clients and a web UI
  - git over SSH — version history for free, manual push/pull
- [ ] **OS for the box** — Debian, TrueNAS, Unraid, or vendor NAS OS

## Build steps

### 1. Hardware
- [ ] Pick and acquire the machine
- [ ] Install OS, set static IP or DHCP reservation
- [ ] Harden: SSH keys only, disable password auth, enable automatic security updates

### 2. Vault
- [ ] Install KeePassXC on the Mac
- [ ] Create `vault.kdbx` — KDBX 4.1, AES-256, Argon2id @ 1 GB / parallelism 8
- [ ] Master passphrase: 6–7 random words, stored offline (written, in a safe)
- [ ] Enable *Backup database file before saving* in KeePassXC settings
- [ ] Import existing passwords from the HDD

### 3. Sync
- [ ] Install chosen sync software on the always-on box
- [ ] Install clients on Mac, Windows, Linux
- [ ] Pair devices, share the vault folder
- [ ] Enable file versioning (keep ~15 versions) as a corruption safety net
- [ ] Test: edit on one machine, confirm it lands on the other two

### 4. Verify
- [ ] Confirm the vault opens on all three OSes
- [ ] Confirm unlock time is ~1s everywhere (retune Argon2id if a machine lags)
- [ ] Restore-test: recover the vault from a versioned copy
- [ ] Document recovery steps somewhere that isn't inside the vault

## Notes

- Don't open the vault directly from a network share (SMB/NFS) — file locking is
  unreliable and a dropped connection mid-save can truncate it. Sync a local
  copy to each machine and open that.
- Don't leave the vault open for editing on two machines at once; sync tools
  produce conflicted copies rather than merging, and reconciling two diverged
  kdbx files is painful.
- RAID is redundancy against a dead disk, not a backup.
