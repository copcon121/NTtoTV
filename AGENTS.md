# AGENTS.md

Huong dan always-on cho agent/dev trong project NTtoTV-linux-rithmic.
Doc file nay truoc khi quet codebase. Ban nay thay the baseline Windows cu.

## Baseline hien tai (2026-11-24)

- Project chinh: C:/Users/Administrator/Desktop/NTtoTV-linux-rithmic.
- Oracle Ubuntu ARM64: https://oracle.gcflowpy.xyz.
- Release da doi chieu: /opt/nttotv/releases/20261124-risk-currency-22.
  Luon kiem tra /opt/nttotv/current vi release co the thay doi sau ngay nay.
- Market data GC chi tu Rithmic: Ticker Plant L1/L2/MBO va History Plant.
- Thuc thi lenh CHI qua Exness API truc tiep, theo tai khoan cua tung user.
  Khong dung MT5 terminal, Windows relay, NinjaTrader hay Bookmap de dat lenh.
- NTTOTV_EXECUTION_MODE mac dinh la exness; disabled tat execution.
  Gia tri windows cu fail closed thanh disabled; khong tu fallback sang MT5.
- Chua duoc phep thay doi Windows live tai C:/Users/Administrator/Desktop/NTtoTV
  khi tac vu chi lien quan project Oracle.

## Kien truc va thu muc

- backend/app/app.py: FastAPI app va REST/WebSocket routers.
- backend/app/runtime.py: pipeline, stores, registry va runtime lifecycle.
- backend/app/rithmic/: connector, Ticker/History Plant va recovery.
- backend/app/execution/: Exness gateway, credentials, account/instrument
  metadata, sizing, REST/event reconciliation va theo doi lenh.
- backend/app/execution/routes.py: API execution; frontend goi same-origin.
- backend/app/engines/, storage/, liquidity_store.py: bars, order flow,
  profiles, ICE, SI Stops va SQLite.
- frontend/src/LiveApp.tsx: chart GC, history, profiles va realtime.
- frontend/src/orders/: ket noi Exness, order ticket va quan ly lenh.
- frontend/src/liquidity/, marketProfile/, footprint/: cac trang chart.
- backend/tests/, frontend/src/**/*.test.ts(x), test-fixtures/: regression.
- deploy/: Linux/systemd/Caddy va immutable-release tooling.
- README-LINUX-RITHMIC.md va EXNESS-EXECUTION.md: huong dan hien hanh.

Mot so file/type van co ten mt5 hoac windows_execution de tuong thich noi bo
va de giu source khop release da test. Ten cu KHONG cho phep bat MT5 execution.
Khong xoa/doi ten cac module nay chi dua vao ten file. API /api/mt5/* va
/api/auto-trade khong duoc mount trong Oracle Exness mode.

## Exness, USD/USC va Amount Risk

- Moi user ket noi bang Exness API key, API secret va platform account ID cua
  chinh ho. Account snapshot va instrument metadata quyet dinh currency,
  contract size, pip/tick value, min lot va lot step.
- Tu nhan dien USD/USC tu account metadata sau connect. Khong hard-code USD.
- Amount Risk dung CUNG don vi voi balance/PnL cua tai khoan ket noi.
  Tai khoan USC: Risk 10 la 10 USC. Khong nhan frontend Risk len 100 lan.
- Sizing dua tren gia Exness, khoang SL va metadata instrument, roi lam tron
  lot theo broker step. Khong sao chep GC futures multiplier sang Exness gold.
- Vi du fixture USC da test: contractSize=1, pipValue=0.1, tickSize=0.001,
  minLot=lotStep=0.01; Risk 10 USC voi SL 5 cho 0.02 lot.
- Giu margin checks, account isolation, stale-basis checks va live gates.
  Loi TRADING_RULE_INSUFFICIENT_MARGIN phai duoc hien thi ro; khong bypass
  broker rule hay tu tang lot de khac phuc.
- Credential Exness duoc ma hoa trong execution.sqlite; master key nam ngoai
  release. Khong in key/secret, copy DB credential hay dua vao fixture/archive.
- HTTP 202/ACK khong dong nghia fill. Doi REST/event xac nhan trang thai cuoi;
  khong tu retry mutation co the gay duplicate order.
- 1R partial-close phai duoc xac nhan truoc khi trailing chay.
- Khong dat/sua/dong lenh live chi de test. Dung fake gateway va fixture.

## Du lieu va networking

- Chart symbol va logical contract la GC. Cache/history/order flow dung
  contract=GC; raw tick shards dung physical contract (vi du GC 12-26).
- Raw tick ghi truoc chart filter/throttle. Khong luu raw full-depth/MBO.
- LQ/ICE/SI Stops dung compact history; xem RITHMIC-ICEBERGS.md, SI-STOPS.md.
- Rithmic repair/history: xem RITHMIC-HISTORY.md; khong import NT export.
- Browser dung same-origin /api va /ws/chart; khong hard-code backend port.
- GC chart price va Exness executable quote la hai instrument khac nhau.
  Giu basis freshness va quy tac chuyen gia hien tai.
- Runtime data /var/lib/nttotv tach khoi source/release. Khong wipe database,
  history, settings, execution state hay backup khi don ma nguon.

## Lenh local va verification

Backend tests (dung Python env hien co, khong ket noi tai khoan live):

    cd backend
    python -m pytest tests/unit/test_execution_mode.py tests/unit/test_oracle_exness_isolation.py

Property tests: dat GC_PBT_EXAMPLES=100 khi kiem tra property suite.
Backend dung pytest/Hypothesis; frontend dung Vitest/fast-check.
Sau thay doi TypeScript/UI:

    cd frontend
    npm run typecheck
    npm test
    npm run build

Local backend phai dung port rieng, vi du 18001, va tat live integrations.
Dat NTTOTV_RITHMIC_ENABLED=0; khong nap production env.
Dat NTTOTV_EXECUTION_MODE=disabled, NTTOTV_TRADING_ENABLED=0 va
NTTOTV_LIVE_TRADING_ENABLED=0 truoc khi chay local server.
Khong restart Windows backend/Caddy hay dung script Windows cu cho Oracle.

## Oracle VPS: truy cap va bao mat bat buoc

SSH de kiem tra service, technical logs, health va deploy duoc phep trong
pham vi tac vu. Quyen SSH KHONG dong nghia quyen doc Admin config.

Neu nguoi dung chua cho phep ro rang trong tac vu HIEN TAI, khong duoc:

- Dang nhap /admin, dung Admin cookie/session, reset owner password, goi
  /api/admin/* hay /api/auth/login.
- Doc, in, copy, grep, tai ve hoac suy dien noi dung:
  /var/lib/nttotv/config/rithmic.json, /var/lib/nttotv/secrets/*,
  /etc/nttotv/credentials/*, /etc/nttotv/nttotv.env.
- Dump process/service environment (systemctl show Environment,
  /proc/<pid>/environ); query SQLite auth/owner/password/token/settings.
- Thay doi Rithmic username/password, app identity, MAC, entitlement,
  auto-connect, History Plant settings hoac bat/tat connector qua API/GUI.
- Dua credential/Admin config vao command output, log, source, release,
  archive, test fixture hay cau tra loi.

Quyen "connect VPS", "kiem tra VPS", "deploy" khong phai quyen doc Admin config.
Neu chan doan can gia tri bi bao ve, xin phep ro rang truoc. Co the sua Admin
source va test bang fake/sanitized config ma khong doc runtime config that.
Neu log bat ngo chua secret, dung xem, khong lap lai va bao user de rotate.

Cac kiem tra technical read-only khong can doc Admin config:

    GET https://oracle.gcflowpy.xyz/health
    GET https://oracle.gcflowpy.xyz/ready
    GET https://oracle.gcflowpy.xyz/api/market-data/status
    systemctl is-active nttotv.service caddy.service
    journalctl, ss, df, free, readlink, caddy validate

Khong grep credential trong log. /ready co the 503 khi market data chua ready;
khong sua readiness hay connector config chi de lam check xanh.

## Dia chi va van hanh

- SSH alias oracle-a1; ubuntu@129.221.134.238.
- nttotv.service: 127.0.0.1:8001; Caddy: 80/443.
- Sample python-app.service: 127.0.0.1:8000; giu nguyen.
- Chi public 22/80/443; 8000/8001 tiep tuc bind loopback.
- /opt/nttotv/releases/<release-id>: immutable releases.
- /opt/nttotv/current: symlink active; /var/lib/nttotv: runtime data.
- /etc/caddy/Caddyfile: active Caddy config.

Windows OpenSSH (khong doc private key hay noi dung ssh_config):

    $sshExe = "$env:WINDIR/System32/OpenSSH/ssh.exe"
    $scpExe = "$env:WINDIR/System32/OpenSSH/scp.exe"
    $sshConfig = 'C:/Users/Administrator/Desktop/NTtoTV-linux-rithmic/_oracle_stage/ssh_config'
    & $sshExe -F $sshConfig oracle-a1 'sudo readlink -f /opt/nttotv/current'

Host fingerprint da pin:
SHA256:VJw2HPTPxdFFvpqvyJOADEppTTXWC+InY49678FGgY4.
Khong dung StrictHostKeyChecking=no. Giu thu muc VPS oracle va ssh_config.
Multiline remote script: single-quoted here-string, bo CR truoc khi pipe vao
ssh 'sudo bash -s'; ket thuc script bang comment de tranh trailing CR.

Deploy khi tac vu yeu cau website thay doi: build integrated source hien tai,
tao immutable release moi, kiem tra, doi symlink va restart nttotv.service.
Khong sua truc tiep current/release cu; khong deploy worktree cu de de len
production moi. Verify public hashed JS asset sau frontend build/deploy.
Giu config, secrets, SQLite va rollback releases. Khong DNS cutover, tat
sample app hay thay doi Windows live neu chua duoc yeu cau ro rang.

## Coding va don project

- Dung rg/rg --files; scope thay doi theo tac vu, prefer helper hien co.
- Manual edits dung apply_patch; khong reset/clean user changes.
- Khong commit runtime DB/log/cache/build/node_modules/venv/export/secret.
- SQLite single writer: dung store methods hien co, tranh writer concurrency.
- Theme Chart/MP/FP/LQ dung token trong frontend/src/styles.css:
  --gc-accent #35d6b0, --gc-background #0b0f14, --gc-panel #111a23.
  Giu Buy/Sell colors va user preferences; reuse liquidity/SettingHelp.tsx
  cho tooltip tieng Viet, keyboard/mobile accessible.
- Khong them contract selector neu user chua yeu cau.
- Don ban source/package staging cu duoc user yeu cau; doi chieu release
  active truoc. Giu regression tests/tooling con dung cho source hien tai.
- Tranh xoa runtime data, SSH material, personal MQL5/reference files,
  research docs, worktree cua session khac va remote rollback releases.
- Truoc recursive delete/move Windows, resolve va kiem tra path nam trong
  target duoc phep; dung native PowerShell voi -LiteralPath.
