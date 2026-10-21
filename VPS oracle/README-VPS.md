# VPS Oracle - python-app-a1

- Public IP: `129.221.134.238`
- SSH user: `ubuntu`
- Shape: `VM.Standard.A1.Flex`, 1 OCPU, 6 GB RAM
- OS: Ubuntu 24.04 ARM64; Python 3.11.17 tai `/opt/python311/bin/python3.11`
- Boot volume: 100 GB

## Ket noi SSH an toan tu PowerShell

Private key va `known-hosts` nam trong folder nay. Khong copy private key vao
source, release hoac VPS. ACL cua private key chi cho tai khoan Windows hien tai
doc.

Fingerprint da xac minh:

```text
SHA256:VJw2HPTPxdFFvpqvyJOADEppTTXWC+InY49678FGgY4
```

Lenh ket noi chuan, dung Windows OpenSSH va strict host checking:

```powershell
$ssh = "$env:WINDIR\System32\OpenSSH\ssh.exe"
$folder = (Resolve-Path "C:\Users\Administrator\Desktop\NTtoTV\VPS oracle").Path
$key = ((Join-Path $folder "python-app-a1-ssh") -replace '\\', '/')
$known = ((Join-Path $folder "python-app-a1-known-hosts") -replace '\\', '/' -replace ' ', '\ ')
& $ssh -i $key -o "UserKnownHostsFile=$known" -o StrictHostKeyChecking=yes ubuntu@129.221.134.238
```

Khong dung `StrictHostKeyChecking=no`. Khong chap nhan fingerprint moi neu chua
doi chieu qua Oracle Console.

## Trang thai staging 2026-10-21

- Sample `python-app.service` van chay tai `127.0.0.1:8000` va public IP `/health`
  van tra `200`.
- NTtoTV Rithmic-only release `20261021-141105` chay tai `127.0.0.1:8001`.
- `NTTOTV_RITHMIC_ENABLED=0`, nen `/api/health` tra `200` va `/api/ready` tra
  `503` theo dung thiet ke staging.
- Lan probe gan nhat voi app identity `NTtoTV Rithmic Connector` bi ca Ticker
  Plant va History Plant tu choi: `rpCode 13, permission denied`. Viec phat
  trien/deploy khong con bi chan boi probe nay; chi nut Connect/readiness va
  cutover production cho Rithmic cho toi khi broker/Rithmic cap quyen.
- Windows Rithmic da duoc khoi phuc va connected sau probe. Firewall rule tam
  thoi da duoc go bo.
- `oracle.gcflowpy.xyz` chua co A record. Caddy staging dang dung HTTP theo Host
  header; chua the cap TLS cho domain nay.

Kiem tra staging tu Windows:

```powershell
curl.exe -H "Host: oracle.gcflowpy.xyz" http://129.221.134.238/health
curl.exe -H "Host: oracle.gcflowpy.xyz" http://129.221.134.238/ready
```

## GUI quan tri Rithmic

Mo truc tiep [http://129.221.134.238/admin](http://129.221.134.238/admin) de xem
trang staging. Vi IP hien chi co HTTP, GUI se khong cho gui password. De cau
hinh that, double-click `OPEN-ORACLE-ADMIN.cmd` trong folder nay, giu cua so
den mo, roi dung URL `http://127.0.0.1:8088/admin`. Luu luong khi do di trong
SSH tunnel ma hoa, khong can thao tac Linux. Dang nhap bang tai khoan web dau
tien cua GC Flow (owner). Tai khoan bootstrap la `admin`; lan dang nhap dau
tien bat buoc doi mat khau tam truoc khi vao trang cau hinh. Moi field deu co
tooltip tieng Viet. GUI co 4 thao
tac: `Save config`, `Test login`, `Save & connect`, va `Disconnect`.

- `Test login` kiem tra dong thoi Ticker Plant va History Plant; can disconnect
  session dang chay truoc khi test. GUI hien rieng ket qua thanh cong/that bai,
  `rpCode` cua tung plant va ly do loi ngay canh cac nut thao tac.
- `Save & connect` luu cau hinh, reconnect runtime va cho Rithmic xac nhan login;
  GUI phan biet `CONNECTING`, `CONNECTED`, `SYNCED` va `ERROR`, khong xem viec
  task dang chay nen la ket noi thanh cong.
- Password khong duoc API tra ve browser. De trong password khi save se giu
  secret hien tai.
- Config khong nhay cam nam o `/var/lib/nttotv/config/rithmic.json`; password
  GUI nam rieng o `/var/lib/nttotv/secrets/rithmic-password`, mode `0600`.
- Chi owner co quyen; tai khoan web khac nhan HTTP `403`.
- Truc tiep bang IP chi expose trang admin va API auth/admin. Sample `/health`
  van giu nguyen.
- L1, L2 va MBO duoc khoa bat ca ba vi `/api/ready` can du ba subscription,
  MBO snapshot va History Plant sync.

## Mang, service va layout

- Public inbound chi co TCP `22`, `80`, `443`; backend `8001` chi bind loopback.
- SSH key-only, password/root login tat; fail2ban va unattended upgrades da bat.
- Caddy phuc vu sample theo catch-all va NTtoTV theo Host
  `oracle.gcflowpy.xyz`.
- `/opt/nttotv/releases/<release-id>`: source, frontend `dist`, virtualenv.
- `/opt/nttotv/current`: symlink atomic toi release hien hanh.
- `/var/lib/nttotv`: `app.sqlite`, raw realtime moi va backup.
- `/etc/nttotv/nttotv.env`: config khong nhay cam.
- `/etc/nttotv/credentials/rithmic-password`: systemd credential mode `0600`.

Lenh van hanh:

```bash
sudo systemctl status python-app nttotv caddy fail2ban nttotv-backup.timer
sudo journalctl -u nttotv -u caddy -n 100 --no-pager
curl -fsS http://127.0.0.1:8001/api/health
curl -sS -i http://127.0.0.1:8001/api/ready
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Backup online hang dem nam trong `/var/lib/nttotv/backups`; da test backup va
restore bang SQLite backup API. Ban Caddy truoc staging nam tai
`/etc/caddy/Caddyfile.pre-nttotv-20261021-103307`.

## Khi Rithmic duyet

1. Mo tunnel va vao `http://127.0.0.1:8088/admin`.
2. Kiem tra field, bat `History Plant` va `Auto-connect after reboot`, bam
   `Save & connect`.
3. Cho den khi Ticker = connected, History = synced va `/api/ready` tra 200.
4. Tao/cap nhat DNS `gcflowpy.xyz`, `www.gcflowpy.xyz` va
   `oracle.gcflowpy.xyz` ve `129.221.134.238`.
5. Tren SSH chay:

```bash
sudo /opt/nttotv/current/deploy/linux/preflight-production.sh
sudo /opt/nttotv/current/deploy/linux/activate-production.sh --confirm
```

Lenh activate tu choi chay neu readiness chua dat, chi sau khi preflight qua moi
tat sample `python-app`. Neu can rollback staging:

```bash
sudo /opt/nttotv/current/deploy/linux/rollback-staging.sh
```
