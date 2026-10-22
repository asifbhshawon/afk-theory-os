# Local Area Network (LAN) & Local HTTPS Setup

**AFK THEORY Business OS** supports multi-user LAN access where all five partners can connect from their phones, tablets, or laptops over trusted office Wi-Fi.

> **Security Baseline:** In standard localhost mode, ports are bound to `127.0.0.1`. When enabling LAN access, HTTP must never be used for authenticated multi-user operations. Local HTTPS ensures session cookies and passwords cannot be intercepted on the local Wi-Fi.

---

## 1. Network Topology

```
Host PC (Windows 11)
[ 192.168.0.45 ]
   ├── Port 443 (HTTPS) -> Caddy Reverse Proxy (Internal Local CA)
   │     └── Port 3000 (HTTP) -> Next.js Web App
   └── Port 5432 (PostgreSQL) -> Private Docker network ONLY (never exposed)

Client Devices (LAN Wi-Fi)
   ├── Shawon's Laptop  -> https://afk.local (or https://192.168.0.45)
   ├── Rafi's Phone     -> https://afk.local
   ├── Tousif's Laptop  -> https://afk.local
   ├── Midhat's Phone   -> https://afk.local
   └── Mueid's Phone    -> https://afk.local
```

---

## 2. Setting Up Local HTTPS with Caddy

Caddy provides an automated internal Certificate Authority (CA) that generates valid local TLS certificates for LAN hosts.

### A. Create `Caddyfile` in project root:
```caddy
afk.local, 192.168.0.45 {
    tls internal
    reverse_proxy localhost:3000
}
```

### B. Map Hostname on Client Machines
On each partner's laptop/PC, add to `hosts` file (`C:\Windows\System32\drivers\etc\hosts` or `/etc/hosts`):
```text
192.168.0.45 afk.local
```
*(Replace `192.168.0.45` with the host machine's actual local IPv4 address from `ipconfig`).*

---

## 3. Trusting the Local Root Certificate Authority (CA)

When Caddy starts with `tls internal`, it creates a root certificate at:
- Windows: `%LOCALAPPDATA%\Caddy\certificates\local\root.crt`
- Or Caddy container volume: `/data/caddy/pki/authorities/local/root.crt`

### On Windows Clients:
1. Double click `root.crt`.
2. Click **Install Certificate** -> Choose **Local Machine**.
3. Place certificate in **"Trusted Root Certification Authorities"** store.

### On Android / iOS Mobiles:
1. Transfer `root.crt` to the phone via USB or email.
2. Go to **Settings** -> **Security & Privacy** -> **More Security Settings** -> **Install from device storage** -> **CA Certificate**.
3. Install and name it `"AFK CA"`.
4. Open Chrome or Safari and navigate to `https://afk.local` (or `https://192.168.0.45`). The padlock icon will indicate secure TLS.
