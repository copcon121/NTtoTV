# Ban giao debug ICE / SI 2.08

Cap nhat: 2026-10-30 10:37, UTC+7. Workspace Windows:
`C:\Users\Administrator\Desktop\NTtoTV`.

## Yeu cau va pham vi

- User thay ICE tren LQ hom qua deu refill=0, muon doi chieu that ky voi
  logic SI 2.08 dang cai trong Bookmap.
- User da yeu cau NGAT nguon BM va NT khoi NTtoTV, chi dung Rithmic.
  Bookmap van chay doc lap bang Rithmic tren GCZ6 de lam doi chung.
- User thay small ICE 2 va 4 trong BM va yeu cau debug ngay.
- User da tu load addon chan doan V1, sau do tat V1 va bat V2 theo yeu cau.
- Yeu cau moi nhat la ban giao cho agent khac. Chua sua logic phat hien ICE
  trong production; KHONG duoc bao da fix xong.

## Ket luan da chung minh

1. Hien tuong refill=0 trong lich su la that, khong phai tooltip/UI reset:
   Oct 29 03:00-24:00 co 61/61 ICE refill=0; US window Oct 29 19:00 den
   Oct 30 04:00 co 15/15, tat ca detectionReason=overfill. Truoc 03:00 van
   co refill>0. Persistence, serialization va frontend giu nguyen counter.
2. Python port KHONG tuong duong hanh vi voi SI 2.08. Da thuc thi truc tiep
   detector trong JAR goc, khong chi doc decompile; 13 replay co assert cho
   ca truong hop khop va khac. Chi tiet o FINDINGS.md va replay-results.json.
3. Da lay duoc native SI event voi exact order ID bang V2 va doi chieu voi
   raw Rithmic trade. Hai ICE 2/4 ban dau co du trade, dung ID va tong volume,
   nhung khong co ICE tuong ung trong bat ky retained direct session nao.
4. Chua xac dinh duoc MBO boundary nao khien tung lenh bi bo lo. Khong duoc
   ket luan tat ca do reprice, mapping sai, mat packet, hay gate thieu.
   Khong luu raw MBO nen khong the replay day du lich su hom qua.

## Hai small ICE da match chinh xac

Tat ca gio duoi day la Oct 30, UTC+7. BID/ASK la phia lenh passive.

| Native order ID | SI event | Rithmic direct trade | Ket qua LQ |
| --- | --- | --- | --- |
| 7816405956569 | DETECTION 2, ASK 4036.7, 05:52:04.8042313 | BUY 2, cung passive ID, source 05:52:04.643805017 | Khong co ICE |
| 7816405956568 | DETECTION 1, BID 4036.6, 05:52:26.6767833; MOVEMENT xuong 4036.5/4036.4; TRADE 3 tai 4036.4, 05:52:29.8999645; total 4 | SELL 1 source 05:52:26.515608993 va SELL 3 source 05:52:29.745321029, cung passive ID | Khong co ICE |

BM timestamp la callback/processing clock, thuong cham hon exchange source
khoang 150-160 ms. Khong dung cua so +/-10 ms de ket luan thieu trade.
Snapshot totalSize co the la latest/final total. Event size, total size va
refillCount la cac dai luong khac nhau; public SI DTO KHONG co refillCount.

Checkpoint doi chieu 06:32:17:

- File `native-direct-comparison-20261030-063217.json`:
  129 canonical native events, 35 native order IDs.
- 33 IDs co raw passive trades; ca 33 co tong raw quantity bang native max total.
- Chi 3 IDs co direct ICE trong tat ca retained sessions; chi 1 trong session
  hien tai. Khong duoc nham "1 current" thanh "chi 1 tung duoc detect".
- Phai loai/ghi chu cac event truoc restart va trong restart gap khi tinh
  missing-rate. Hai native IDs 7816406033630 va 7816406034551 nam sat/trong
  lan restart 06:11; raw trade ngat tu 06:10:58.586 den 06:11:10.476.
- Cac ID 7816406067798 (BID 4026.2, total 5), 7816406068573 (BID 4025.9,
  total 3), 7816406069336 (ASK 4026.3, total 2), 7816406069334 (BID 4025.6,
  total 5) cung thieu direct ICE du du raw volume. Native khong ghi MOVEMENT
  cho chung. Khong co trong compact contexts da lay KHONG chung minh chua
  tung co reprice/mismatch: deque chi giu 10 va polling co the bo sot.

## Cac khac biet logic goc da xac nhan

- Core SI `com.bookmap.a.a.a.a` co confirmation gate dung chung voi aggressor
  chain. Trade dau seed chain, aggressor ID khac bat dau chain; opposite-side
  trade huy chain va dat b=false. CHINH trade huy van duoc deduct; trade sau
  do bi skip den khi MBO send/replace/cancel goi a(true). Depth a(false) reset
  chain nhung khong rearm b=false. Python hien chua co gate nay.
- Khong gate nguyen Python on_trade: SI co listeners h -> g -> l cap nhat
  lifecycle/executed volume cua ICE DA detect tren moi trade, doc lap gate,
  va xem ca passive/aggressor ID. Can tach candidate confirmation va lifecycle.
- Same-ID reprice: SI giu identity/executed accounting qua doi gia; Python
  reset candidate chua detect, hoac invalidates ICE da detect. Replay JAR
  chung minh SI co the detect tren replacement doi gia ma Python bo lo.
- Python trade-through invalidation dung lifecycle som hon SI. Day la khac
  biet bao thu da co, khong tu no giai thich duoc toan bo thay doi lich su.
- Hai native triggers co ban van khop khi input ordered va cung gia:
  remainder < 0 sau trade, hoac remainder == 0 truoc positive replacement.
  Overfill hop le co the refill=0. Khong tu che refill de khop UI.
- Absolute CHANGE/trade bi dao thu tu co the double-deduct o ca hai detector.
  Replay synthetic chi chung minh do nhay voi input semantics/order, chua
  chung minh dieu do da xay ra tren live Rithmic.

## Mapping da kiem tra, chua thay loi

Da doi chieu RProtocolAPI 0.90 va original BM adapter:
NEW=1, CHANGE=2, DELETE=3; current price field154405; previous price154906
duoc gate boi154930; side153612; size64=159009; passiveID149238;
aggressorID154641. IDs giu string, khong thay numeric truncation/price swap.
Live frames chu yeu mot complete order row. Khong dao mapping dua vao ty le
trade_unknown/change_unknown. mboLastSequence=null nen gap counter=0 KHONG
chung minh continuity day du.

## Production hien tai va thay doi da deploy

- Kiem tra lai 10:37: activeSource=preferredSource=rithmic, connected=true;
  sources.bookmap.enabled=false, sources.nt.enabled=false.
- Runtime `scripts/Run-BackendProcess.ps1` dat
  NTTOTV_MARKET_DATA_RITHMIC_ONLY=1 va preferred source rithmic.
- `config.py`, `app.py`, `pipeline.py`: khong mount BM/NT ingress/native-bar;
  arbitration khong fallback sang BM/NT. Da kiem tra WS BM/NT/nt-capture=403,
  NT native-bar=404. Khong reconnect bridge du user dang mo Bookmap.
- Restart lan 1 ~05:50:50, session 4faaa61248ab4dc1be6213ad35d9d028.
- Restart lan 2 ~06:11 de them DIAGNOSTICS, session hien tai
  091979cda0254d28aed6235a1a9f0bcf. Khong restart BM.
- `native_iceberg.py`: da them deque(maxlen=10) icebergIdentityContexts,
  record pre-discard reprice/trade mismatch voi ID, side/price, remainder,
  executed/refills va timestamps. Them counter exhausted_candidate_reprice.
  Khong doi signal rules.
- Capture 06:11 trong 120s: 42 reprice contexts, tat ca executed=0.
  Capture 06:22 trong 300s: 63 contexts (60 reprice + 3 mismatch), executed=0.
  Chua thay exhausted_candidate_reprice. Chua co bang chung day la nguyen
  nhan bo lo ICE 2/4.
- Metrics 10:37: detected_overfill=10, trade_known=1055, trade_unknown=18532,
  change_known=1815, change_unknown=14428, removed_trade_through=10.
  icebergDetectedOrders=0 la so dang active, KHONG phai tong lich su=0.
- Khong doi auth/Admin/trading config, khong truy cap Oracle.

## V2 native capture: DA CHAY THANH CONG, hien DA KET THUC

JAR:
`si2-subscriber/NTtoTV-SI2-Diagnostic-Capture-v2.jar`

SHA256: `eb7fba148fd8e0e38b1bf188d5e103227aebb2eb3623bef9df8abdb57cd56085`.

User da bat V2 ~06:29. File co snapshot + live typed ICE events:
`bookmap-si-capture/si2-v2-2026-10-29T23-29-09.995687Z-8d7348a2.jsonl`.

Kiem tra 10:37: file da co capture_end, written=1924, queueOverflow=0;
ket thuc khoang 08:29 theo gioi han 2h. KHONG noi V2 van dang capture live.
Checkpoint comparison 06:32 chua phan tich phan lon du lieu them sau do;
agent tiep theo nen rerun comparison tren TOAN BO file truoc khi can capture moi.

V1 connected duoc provider nhung instanceof fail vi addon classloader khac;
V1 khong co usable ICE records. V2 dung exact public DTO names va whitelisted
public getters, da test isolated original-JAR classloader. Khong private
reflection, khong bo qua license/version/publication checks, khong subscribe
market data, khong co trading/network, khong noi BM vao NTtoTV.

V2 lookback 90 phut, queue5000, max50000 records, timeout2h. Khong rebuild/
overwrite loaded JAR. Neu can capture live moi, can enable lai V2 qua UI
binh thuong va xac minh file moi thuc su duoc ghi.

## Phan dang do - CHUA IMPLEMENT

Da du kien them bounded causal trace de biet tai sao order khong duoc track
luc trade den, nhung chua thuc hien. Kiem tra source 10:37: KHONG co
trade_context_snapshot, iceberg_trade_context_snapshot hay iceberg-trace endpoint.
Subagent tung nhan viec nay bi usage limit; khong coi nhu da hoan thanh.

Huong tiep tuc de nghi:

1. Rerun exact native/direct comparison tren full V2 capture da ket thuc.
2. Them compact trace KHONG DOI detection rules: per-ID last accepted MBO
   boundary va last removal reason (bounded maps, vi du 5000 IDs), trade ring
   (vi du 128), truoc unknown/mismatch return record trackedBefore,
   remainder/executed, last boundary/removal va source timestamps.
3. Co cursor sequence/session va coverage/truncation bounds; vang lookup
   khong duoc dien giai la "chua tung ton tai" khi map da evict.
4. Expose read-only qua Rithmic service va endpoint chi direct loopback,
   tai su dung `_require_direct_loopback` trong rest/market_data.py;
   reject forwarded/x-forwarded-for. Khong public bulk trace, khong luu raw MBO.
5. Tests: unknown ID, DELETE-before-trade, price mismatch, bounds/copy/session
   reset, endpoint cursor/forwarded reject, detection behavior giu nguyen.
6. Sau tests moi restart backend bang script chuan, lay bounded compact trace
   song song native SI events; tim exact boundary truoc miss. Giu nguyen BM.
7. Sua candidate gate/reprice/lifecycle tren co so replay goc va live causal
   evidence; khong gate mat executed volume cua ICE da detect.

## Files va lenh de tiep tuc

Bat dau doc HANDOFF.md nay. FINDINGS.md la audit ban dau, FOLLOWUP-20261030.md
chi cap nhat den ~06:27, con dong "V2 chua load" DA LOI THOI; dung handoff nay
cho trang thai moi nhat.

- `replay_original_si.py`, `OriginalSiProbe.java`, `replay-results.json`:
  13 controlled original-JAR/Python cases.
- `compare_native_si_capture.py`: read-only comparison; exact ID, dedup
  snapshot/live, provenance, all retained direct sessions; --self-test da pass.
- `native-direct-comparison-20261030-063217.json`: checkpoint, khong phai
  ket qua full capture 2h.
- `capture_identity_probe.py`, `identity-probe-20261030-061130.jsonl`,
  `identity-probe-20261030-062228.jsonl`: bounded compact contexts.
- `runtime-summary.json`, `source-isolation-start.json`: baseline audit.
- `si2-subscriber/README.md`, `build_v2.py`,
  `build-v2/cross-loader-test.txt`: addon va classloader test.
- Original decompile: `analysis/si-2.08-20261029/decompiled/`.
- Original JAR:
  `C:/Bookmap/API/Layer1ApiModules/7.4.0.1---7.7.1.9999---2---stops-icebergs-on-chart---2.08.jar`;
  SHA256 `317e2a8b45e3290e2d4fd41a371e06f08f71b9f3c2fc1072f91b3eb682a215ab`.
- Java/javac/javap: `C:/Program Files/Bookmap/jre/bin/`.
- Pipeline: `backend/app/rithmic/service.py` _dispatch -> native detector
  on_trade/on_mbo_update -> pipeline/storage/frontend ICE channel.
- Raw trade shards: `backend/data/ticks/GC/GC_12-26/` (read-only SQLite mode=ro).
  Logical chart/cache contract=GC, wire=GCZ6, real contract=GC 12-26.

```powershell
# Tu repo root, read-only comparison tren tat ca native capture hien co:
backend/.venv/Scripts/python.exe analysis/iceberg-refill-audit-20261030/compare_native_si_capture.py --restart-at 2026-10-30T05:50:50+07:00 --restart-at 2026-10-30T06:11:00+07:00

# Replay compiled original detector vs Python:
backend/.venv/Scripts/python.exe analysis/iceberg-refill-audit-20261030/replay_original_si.py

# Health/status:
Invoke-RestMethod http://127.0.0.1:8000/api/health
Invoke-RestMethod http://127.0.0.1:8000/api/market-data/status

# Chi khi co thay doi backend da test can deploy:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Restart-Backend.ps1 -TimeoutSec 45
```

Checks da pass trong qua trinh debug (khong rerun khi chi viet handoff):
117 focused source-isolation tests; 72 native ICE/Rithmic/channel tests sau
them diagnostics; 13 original-JAR replay assertions; V2 cross-loader test.

Repo co NHIEU dirty/untracked changes tu truoc va cac tac vu khac, ca
frontend/SI Stops/auth/MP. Khong reset/checkout/overwrite. Source changes cua
debug nay chu yeu isolation + compact identity diagnostics. Khong commit DB,
logs, screenshots, generated JAR/build outputs. Dung CodeGraph truoc khi tim/
doc code vi repo co .codegraph; dung apply_patch cho manual edits. Git khong
nam tren PATH; binary hien co o
`C:/Users/Administrator/AppData/Local/GitHubDesktop/app-3.6.6/resources/app/git/cmd/git.exe`.

Khong can restart Caddy cho backend-only changes. Public frontend la
https://gcflowpy.xyz/, khong phai old port9999. Khong kill Bookmap/NT/MT5,
khong reset data, khong doc credentials/config Admin/Oracle.
