# TTW Hidden Orders va Bookmap Stops & Icebergs: ket qua doi chieu

Ngay phan tich: 27/10/2026, mui gio Asia/Bangkok.

## Ket luan de chon huong tich hop

De xuat lay **co che Native iceberg theo tung order ID cua Stops & Icebergs**
lam nen tang cho GC; tham khao TTW cho hien thi qua trinh phat trien, nguong
loc va theo doi khoi luong. Synthetic nen la che do suy luan rieng.

Day la danh gia dua tren dieu kien trong bytecode, chua phai ket qua do do
chinh xac tren du lieu GC. Sau do nguoi dung yeu cau port vao direct Rithmic;
ban native da duoc implement va activate, xem `RITHMIC-ICEBERGS.md` o root.

Ly do chon: SI doi bang chung order khop vuot phan hien thi hoac duoc nap lai
sau khi phan hien thi ve 0. TTW Native chap nhan dieu kien rong hon: tang
phan hien thi sau khi da co khop. Dieu kien TTW co the nhan ca mot lenh
thuong duoc chu lenh tang size sau khi khop mot phan.

## Addon thuc te da nap

| Addon | Ban da nap trong Bookmap | Bang chung |
| --- | --- | --- |
| TTW TradeFinder | `Desktop/tradefinder-3.7.1.jar`, 3.7.1 b3 | Log hien tai dong 696-700: addToLayers=true, SESSION LIVE, LOAD/START |
| Stops & Icebergs On-Chart | `Desktop/stops-icebergs-on-chart-1.05.jar` | Log dong 734-735: SitIndicator addToLayers=true va enabled=true |

Log: `C:/Bookmap/Logs/log_20261026_213006_331-common.txt`.
TTW bat dau luc 19:25:44-45; SI duoc nap luc 20:16:51, gio Bangkok.
PID Bookmap quan sat duoc: 11164. Tieu de cua so va catchup SI cho thay
chart hien tai la **AAPL@DXFEED**. Chua xac nhan chay phat hien tren GC.
Enabled o muc addon khong chung minh toggle Hidden Orders cu the da bat,
feed co MBO dung chat luong, hay da co phat hien iceberg thanh cong.

Ban `TTW-3.7.4-@Volume_Tools.jar` co san nhung khong phai ban TTW duoc log
hien tai nap. Ban SI 1.17 co san duoc doi chieu them, khong coi la ban live.

SHA256 cua artifact da phan tich:

| Artifact | SHA256 |
| --- | --- |
| TTW 3.7.1 active | `c273d1f696834dd29beffcb8672ca576e7e58b2d3724aa9515a4f3ad12607c28` |
| TTW 3.7.4 candidate | `cc6b3237f7d566fdd0db8444309a89d0d6cc6d490c816148e6cf007c6e1fa27e` |
| SI 1.05 active | `173460b4764d1c99127107bf6bd817fbcbd2c72664a81120311dbc3aadcc0c8a` |
| SI 1.17 comparison | `6e09b1935e5f5a66aa4b28f2a45fc867e0b9b3c6a2184ca5be13ced4e4f7eb20` |

## Phuong phap va gioi han cua REA

Da dung REA `open_binary` voi TTW 3.7.4, TTW 3.7.1 va SI 1.05: nhan dien
ZIP/JAR va digest. `inspect_artifact` bi tu choi do collision tren Windows:

- TTW 3.7.4: `ttw/tradefinder/Aa.class` / `AA.class`.
- TTW 3.7.1: `ttw/tradefinder/ga.class` / `Ga.class`.
- SI 1.05: `velox/indicators/sionchart/A.class` / `a.class`.

Khong sua/rename noi dung JAR de vuot qua rang buoc nay. Buoc tiep theo dung
ZIP read-only, CFR 0.152 va `javap -p -c` voi Java co san trong Bookmap.
Cac chuoi UI XOR cua TTW duoc giai ma tinh bang script; khong load/chay addon.
CFR doi ten class de tranh trung chu hoa/thuong; source phuc dung co loi
kieu/ten field do obfuscation, nen dieu kien quan trong duoc doi chieu javap.

Khong co REA Evidence ID cho ket luan ve thuat toan: artifact inventory that
bai truoc khi sinh evidence. File `rea-evidence.json` co 0 records; khong duoc
coi no la chung nhan phan tich hoan tat. Bang chung thay the la JAR co hash
o tren, bytecode luu lai va source phuc dung. Phan reverse engineering khong
quan sat execution cua addon detector, khong doc/thay doi license, credential
hay runtime trading.

## TTW Hidden Orders 3.7.1

Duong du lieu quan sat duoc:

`ag.onTrade/onMboSend/onMboReplace/onMboCancel -> Jb -> IE -> jF/Oe`.

`ag` dispatch ca trade, MBP depth va MBO, dung timestamp cua event.
`Jb` la bo dieu phoi Hidden Orders; labels duoc giai ma xac nhan Hidden
Bid/Ask, Native/Synthetic/Combined, Order Size Trigger va trace.

### Native

`IE` giu trang thai theo order ID. Trade duoc doi chieu ca passiveOrderId
va aggressorOrderId; cum aggressive executions ban dau co the duoc carry
vao trang thai khi order do xuat hien trong MBO.

Trang thai `jF` giu tong da khop, phan hien thi con lai, snapshot tong khop
tai lan replace truoc, thoi diem phat hien, price va thoi diem ket thuc.

Dieu kien xac nhan tai `jF.E(long,int,int)`:

```text
oldRemaining = displayedRemaining
previousExecutionCheckpoint = executedAtPreviousReplace
displayedRemaining = replacementSize
executedAtPreviousReplace = totalExecuted

if notYetDetected
   and replacementSize > oldRemaining
   and totalExecuted != previousExecutionCheckpoint:
    detectedAt = eventTime
```

Moi trade tang tong da khop va tru remaining, clamp remaining ve toi thieu 0.
Neu da xac nhan thi tra volume update; neu chua thi giu volume cho den luc
xac nhan. MBO cancel/remove dong order va chi phat completion khi da co
detectedAt. Nhan cancel la ket thuc lifecycle, khong tu no chung minh da
khop het hay huy het hidden reserve.

Bang chung: `active-3.7.1/detection-bytecode.txt:14`, method offsets 82-109;
trade accumulation tai `:303`, offsets 0-62 va 125-157.
`decoded/ie_0.java:33,77,93,173,215`; `decoded/jf_1.java:27,148`;
`decoded/jb_2.java:209,298,414`.

### Synthetic co hai duong khac nhau

1. `PE` (du lieu trade + MBP): khi chuyen sang gia giao dich moi, chup volume
   DOM o gia do lam baseline. Cac trade tiep theo cung gia duoc cong vao cho
   den khi vuot baseline; sau do tich luy volume synthetic, co nguong bo qua
   trade nho. Khi gia thay doi thi dong cum. Trade dau cua gia moi dung de
   khoi tao va khong duoc cong o nhanh nay. Khong thay buoc lien ket parent
   order hay timeout refill trong method nay.
2. `se` (MBO): ghi nhan order moi tai gia trade hien tai, dung side va lon
   hon ignored-size; trade ve sau co passiveOrderId nam trong tap nay duoc
   cong vao cum synthetic. Chuyen gia thi dong cum, cancel thi bo ID.

Chi tiet dang chu y: bo loc mode trong `Jb.E(ae,dg)` khong don gian la
Native union Synthetic. Native cho loai `dg.M`; Synthetic cho `dg.b` (PE);
Combined loai `dg.b`, giu Native `dg.M` va synthetic theo MBO `dg.C` (se).
Da kiem tra dieu nay trong `entry-bytecode.txt:556`, offsets 0-49.

Voi aggregated depth, volume khop vuot baseline co the do nhieu lenh moi
doc lap tai cung gia. Vi vay khong nen gan nhan native iceberg da xac nhan
cho ket qua synthetic. Duong MBO synthetic cung chua chung minh cac ID moi
thuoc chung mot hidden parent.

Bang chung: `decoded/pe_1.java:23`, `decoded/se_0.java:36,79`,
`decoded/jb_2.java:230`.

### Nguong va hien thi

Default trong code: trigger 300 don vi raw size, Synthetic Ignored Size 2
don vi raw size; co quy doi theo sizeMultiplier. Trace default 20% trigger.
Day la default artifact, **khong phai settings live da doc**. Final signal
loc theo tong volume da khop sau khi order ket thuc; development/trace co
duong cap nhat khi order dang hoat dong va dieu kien rieng.

Nen hoc cach hien thi executed volume, visible tranche, duration, side va
active/completed tu TTW. Khong nen coi default 300 la nguong toi uu cho GC.

Bang chung: `decoded/za_0.java:35`, `decoded/ua_0.java:57`,
`decoded/ae_0.java:27`, `decoded/jb_2.java:414,497`.

## Stops & Icebergs On-Chart

Bao cao chi tiet va line/offset: [bookmap-si/FINDINGS.md](bookmap-si/FINDINGS.md).

SI 1.05 kiem tra feed co MBO va can event khong bi aggregation. Core detector
giu visible remainder theo passive order ID va xac nhan mot lan khi:

```text
onTrade: remainder -= tradeSize
         detect if remainder < 0
onReplace: detect if previous remainder == 0 and not yet detected
           remainder = replacementSize
```

Sau phat hien, bo accounting giu executed volume tu truoc phat hien va
theo doi DETECTED, TRADE, MOVED, EXECUTED/CANCELED, active/inactive. Gia tri
tich luy la volume **da khop**, khong phai toan bo hidden reserve con lai.

Stop chain duoc suy luan khi aggressor ID thay doi trong chuoi trade truoc
MBO update tiep theo; khong co exchange flag xac nhan tat ca la stop orders.
SI 1.17 them kiem tra side/aggregation va reset theo depth. Nen xem Stop
la tinh nang suy luan rieng, chua gom vao ban iceberg dau tien.

Active 1.05 khong co broadcast API. Local 1.17 co class broadcast nhung live
emitter rong, da xac minh bytecode. Khong nen lap bridge chi dua vao ten
class Subscribe/Event ton tai. Ban 1.18 trong build cu chua duoc doi chieu
va khong nam trong ket luan nay.

## So sanh dieu kien bang vi du

Cac dong sau la he qua suy ra tu dieu kien tinh, khong phai live replay.
Bo qua nguong hien thi de chi doi chieu thoi diem detector xac nhan.

| Cung mot order ID | SI Native | TTW Native |
| --- | --- | --- |
| Hien thi 10, khop 6+4, replace len 10 | Phat hien luc replace | Phat hien luc replace |
| Hien thi 10, khop 11, chua replace | Phat hien vi remainder am | Chua xac nhan; doi replace |
| Hien thi 10, khop 2, replace len 12 | Chua phat hien | Phat hien vi size tang sau khop |
| Nhieu ID doc lap khop o cung gia | Khong gom thanh native | Native khong gom; synthetic co the gom |

Dong thu ba cho thay SI bao thu hon voi partial fill + resize. Van can
du lieu dung thu tu va day du: mat event/aggregation co the tao overfill
gia hoac lam mat refill. Khong addon nao tu nhung dieu kien nay biet truoc
toan bo volume hidden chua giao dich.

## Do phu hop voi du lieu cua du an

Da doi chieu source, khong doc runtime stores:

- `bookmap-bridge/src/main/java/com/nttotv/bookmap/BookmapMarketDataBridge.java:31`
  chua implement MBO listener. Trade JSON tai `:286` da giu IDs, execution
  flags va nanosecond time; backend giu tai `backend/app/ingest/bookmap_endpoint.py:145`.
- `BookmapWebSocketSender.java:19,72,108,120`: queue co gioi han, co the bo
  event cu/overflow va clear khi reconnect. Footprint snapshot chi sua du
  lieu tong hop, khong phuc hoi lich su tung order.
- `backend/app/rithmic/protocol.py:438,620` decode MBO new/change/delete va
  trade order IDs. `rithmic/book.py:257,282,297` co snapshot/gap handling;
  `rithmic/service.py:518` hien chi dua metrics MBO ra sink, chua chuyen
  tung before/after order change cho iceberg engine.
- `backend/app/pipeline.py:1103,1116,2672` la mau compact liquidity theo
  source va source switch co the tai su dung. Feed ready cho OHLCV khong
  dong nghia MBO da synchronized.
- Legacy `bookmap_si_event` da bi bo qua o `models/messages.py:150`; test
  `tests/unit/test_message_schemas.py:344` xac nhan. Khong co SI integration
  hien hanh de chi bat lai bang mot settings flag.

## Pham vi ban tich hop dau tien duoc de xuat

1. Detector doc lap trong Bookmap bridge, nhan MBO send/replace/cancel va
   trade theo cung thu tu callback. Dung co che Native SI, them kiem tra ID,
   side, gia va trang thai feed. Khong nhung/patched class addon vao ung dung.
2. Gui compact `start/update/end/snapshot` voi source, contract, session
   generation, order key, side, price, executed volume, visible remainder,
   timestamps va ly do ket thuc. Khoa state theo source/session/contract/ID.
3. Backend chi publish source active, dung chart contract `GC`; ngat lifecycle
   cu khi disconnect/gap/source switch. Mat compact update thi snapshot sua
   trang thai hien tai; khong tu nhan da phuc hoi event lich su bi mat.
4. Hien thi iceberg dang active va da ket thuc, loc volume va duration theo
   settings. Dung ten `executed volume`; hidden reserve chua biet de unknown.
5. Them Rithmic fallback theo cung contract compact sau khi noi diem MBO
   ordered dispatch. NT L1 fallback khong phat native-confirmed iceberg.
6. Synthetic va Stop chain la cac che do suy luan rieng, can replay/doi chieu
   truoc khi dua vao canh bao.

Kiem thu can co khi implement: overfill, full-fill/refill, partial resize,
side/price inconsistency, missing IDs, duplicate/out-of-order events,
unknown replace/cancel, reconnect/snapshot, source switch va threshold.
Can shadow replay/quan sat GC Rithmic MBO truoc khi dung tin hieu giao dich.

## Cap nhat pham vi sau khi nguoi dung chi dinh direct Rithmic

Nguoi dung da yeu cau port logic vao connector Rithmic MBO/L1/L2 co san,
khong config Bookmap. Huong Bookmap bridge o phan de xuat ban dau duoc thay
bang detector inline trong `RithmicMarketDataService`. Tien do va gioi han
cua phan implementation duoc ghi tai `RITHMIC-ICEBERGS.md` o root repo.
Khong thay doi Bookmap configuration, addon hay connection cua Bookmap.

## Checklist va unknown con lai

- Xac minh addon da nap: hoan tat, theo log/cua so; chua doc license validity.
- TTW Hidden Orders logic: da trace ba duong Native/PE/se va threshold.
- SI iceberg/stop logic: da trace ban active 1.05, doi chieu co gioi han 1.17.
- Source compatibility va huong tich hop: hoan tat o muc thiet ke.
- Hidden Orders toggle live, GC MBO entitlement/quality, event ordering tren
  feed thuc, do chinh xac va nguong GC: chua xac minh.
- Phan dieu tra nay chi ghi ket qua static; trang thai implementation/deploy
  sau yeu cau tiep theo nam trong tai lieu root va bao cao hoan thanh.
