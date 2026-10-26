# Đối chiếu và hoàn thiện tín hiệu OF7 — 25/10/2026

## Phạm vi

Đã xem bản phân nhóm người dùng gửi, đọc lại DLL bằng REA và đối chiếu mã
decompile của đúng `OrderFlowsTrader.dll` 7.0.1.0. Bản dựng Python có hai đầu
ra riêng: `signals` tương thích hành vi gốc và `analysis_signals` áp chính sách
sửa lỗi có version. Chưa triển khai ML hoặc thay đổi chức năng đặt lệnh.

- SHA-256 DLL: `d47bbcfad05978a3864297e6a569f99be736984ac474c58ab31065e4a4f07cce`.
- MVID: `654b7c96-319b-4bd2-9f40-f246ae6445a8`.
- REA metadata: `ev_aaa553c2d02b36f872aa5335e74100abe844ad1cfc8341f60f1e8d03cf0c8cad`.
- REA CIL: `ev_70cc7129c505c96a252e398eef3ec74730e748e8b0ef6f92e6344577be79f87d`.
- Decompiler: ILSpy 8.2.0.7535; dùng trên bản DLL có hash nêu trên.

REA hỗ trợ managed metadata/CIL trên Windows nhưng không hỗ trợ native UI
observation trên host này (`unsupported_host`). Vì vậy kiểm tra mã dùng REA;
kiểm tra cửa sổ và tham số đang mở dùng Windows UI Automation; lấy ladder/series
dùng AddOn chẩn đoán chạy trên thread của indicator. Không gộp ba loại bằng
chứng thành một tuyên bố runtime parity.

## Sửa cách phân nhóm và diễn giải

[OF7-SIGNAL-GROUPS.md](OF7-SIGNAL-GROUPS.md) ánh xạ đủ 33 ID vào sáu nhóm đo:

1. Quan hệ nến và Delta.
2. Hình dạng volume ở cực trị.
3. Phân bố imbalance.
4. Phân bố volume theo mức giá.
5. Vị trí và dịch chuyển POC.
6. Hình học Value Area.

Nhóm/tag có thể dùng làm metadata; “đảo chiều”, “breakout thành công” hoặc
“hấp thụ thành công” phải là giả thuyết/kết quả đo riêng. Tác giả OF7 cũng
mô tả order flow là công cụ phân tích thay vì một hệ thống giao dịch hoàn
chỉnh: [nguồn hãng](https://www.orderflows.com/special.html).

Các câu đã sửa gồm: Delta Tail/Sequencing không chứng minh thứ tự thời gian
trong nến; Ratio không chứng minh volume tuyệt đối lớn/nhỏ; Delta Divergence
của OF7 không phải classic swing divergence; hai nến xanh không đảm bảo close
sau cao hơn; Aligned POC không đủ chứng minh cân bằng; OF Gap không phải vùng
chưa từng có trade. Số 32 trong bản trình bày không phải số detector/feature.

## Các sai lệch mã đã sửa

| Vùng | Kết quả đối chiếu và thay đổi |
|---|---|
| Swing gate | Chặn các bar đầu trước cả khi xét bật/tắt filter; giữ `bar_index` và `current_bar_index` riêng |
| Swing offset | Dùng hướng nến hiện tại, extreme ở offset; cửa sổ cũ là setting + 1; xử lý cửa sổ đầu lịch sử |
| Filter tự thêm | Bỏ filter chung không có trong Open POC, Aligned POC, EVA, Reload, Prominent POC |
| Session extreme | Chạm lại đúng High/Low phiên cũng hợp lệ, không chỉ tạo extreme mới |
| POC | Từng tick, giữ POC trước nếu hòa hoàn toàn; side POC dùng volume cùng phía; giữ lỗi Bid POC trong compatibility |
| Value Area | Mở rộng qua key thật, hòa ưu tiên phía trên, có reset/thu hẹp tích lũy; không tính lại một cách khác sau mỗi snapshot |
| Sparse ladder | Phân biệt row zero từ indexer với key thực sự tồn tại; không fill toàn bộ giá thiếu |
| Sweep/Sequencing | Độ dài theo khoảng giá; Sequencing bỏ row làm đứt chuỗi, bỏ Ask=0 ban đầu |
| Cluster | Giữ cách duyệt sorted key và endpoint zone của DLL, gồm trường hợp ladder thưa |
| Market Weakness | Gate chỉ số bar riêng; N=1 không chạy vòng so dấu Delta |
| Zero Print | Xác nhận zone hai mức chính xác và Contains guard; nhánh Sell ghi Buy được lưu provenance |
| Raw ratio | Giữ giá trị ngay cả khi không có tín hiệu; row thiếu đọc zero theo DLL; lưu mẫu số |
| Imbalance 0/0 | Không phát imbalance với tử số và mẫu số cùng 0 dù min volume bằng 0 |

## Sửa lỗi cho nghiên cứu, giữ bản gốc để đối chiếu

Policy `of7-corrections-v1` trong `research.py`:

- A/D Buy dùng điều kiện AND đối xứng với Sell, loại trường hợp OR luôn đúng
  khi passive filter tắt.
- Loại Price Defense khi mẫu số bằng 0 khỏi `analysis_signals`.
- Loại Stacked trái màu nến ở nhánh terminal bất thường.
- Tách filter Inverse/Stacked để một filter không chặn feature còn lại.
- Vertical swing so với các bar cũ, loại chính current bar khỏi cửa sổ so sánh.

`side` đã ánh xạ theo hướng zone của Tails/Sequencing/Zero Print;
`original_series` vẫn giữ tên gốc phục vụ audit. Không sửa DLL của hãng.
Các sửa logic trong policy là lựa chọn của bản nghiên cứu, không được báo là
hành vi gốc hoặc bằng chứng lợi thế giao dịch.

JSONL schema `of7-research-v2` xuất cả hai tập tín hiệu, số đo liên tục,
`feature_counts` và `analysis_feature_counts`, metadata nhóm, toàn bộ tham số,
config hash, policy version, nguồn/contract, thời điểm quan sát và cờ chất
lượng. Không dùng count=0 thay cho “đã sẵn sàng” khi warmup còn thiếu.

Đã bổ sung `observed_volume` và `unclassified_volume`: tick thiếu/crossed
quote có thể tăng input volume nhưng không thuộc Bid/Ask/Between theo chính
DLL. Dữ liệu xuất phải giữ phần chênh lệch này và cờ chất lượng, không biến nó
thành Between hoặc làm mất âm thầm. Engine cũng từ chối reference bar index
nhảy cóc để không ghép các bar thiếu thành một chuỗi lookback giả.

## Bằng chứng thực thi DLL gốc

`scripts/Export-Of7BarDataOracle.ps1` nạp kiểu `BarData` công khai trong DLL
gốc vào một tiến trình riêng và gọi `AddTick` bằng tick giả lập. Không attach
process NT, không tạo indicator/strategy, không gọi licensing hoặc gửi lệnh.

Fixture `test-fixtures/of7/bardata-oracle.json` có năm ca, so sánh **sau mỗi
tick**: sparse/locked/crossed/Between, POC/side POC, VA, imbalance và cùng
ladder cuối nhưng thứ tự tick ngược. `test_of7_stream.py` replay Python khớp
toàn bộ expected của fixture. Phạm vi này là lõi BarData, không chứng nhận
volume reconciliation của NT processor hay mọi detector trên chart.

## Kiểm tra OF7 đang mở trong NinjaTrader

Đã tìm đúng chart `GC 12-26`, `1 Minute`, OF7 đã gắn. Đã đọc các tham số tính
toán bằng allowlist và đóng dialog bằng Cancel, không thay đổi tham số:

| Tham số | Giá trị đang mở |
|---|---|
| Fast Historical Data Processing | On |
| VA / min imbalance volume / imbalance percent | 70 / 10 / 400 |
| Global lookback / Ratio low / Ratio high | 5 / 0.69 / 30 |
| Up/down tick mode | Off |
| Feature bật | Delta Divergence, Ratio, ba Prominent POC level, Stacked, VA, EVA |

AddOn `nt-addon/ninjascript/OF7AuditExportAddOn.cs` đã được chép sang thư mục
NT Custom/AddOns và compile trong NT. Nó chỉ đọc các tính toán allowlist,
BarData và `_allSeries`; không đọc credential, account hay license token.
File kết quả giới hạn 300 bar đóng, lưu dưới `%TEMP%/nttotv-of7-audit-*.json`.
Thời gian chart lưu cả text và `DateTime.Kind`; không tự giả định là UTC.

Sau khi người dùng tải nến/footprint, AddOn đã đọc chart có 1650 bar và xuất
300 bar đóng (index 1349–1648). So với Python bằng mode `historical-fast`:

- 293 bar được so, bỏ 7 bar đầu capture để có đủ lookback.
- 19338 giá trị/validity series, không sai lệch.
- 285 raw ratio được so, không sai lệch.
- Timestamp chart có `Kind=Unspecified`; không tự coi nó là UTC.

| Feature đang bật | Số bar có output native và Python khớp |
|---|---:|
| Prominent POC level 1 / 2 / 3 | 9 / 12 / 4 |
| Delta Divergence | 6 |
| Ratio Price Defense | 168 |
| Value Area | 293 |
| Engulfing Value Area | 18 |
| Stacked Imbalance / Ratio Exhaustion | 0 / 0; chưa xác nhận nhánh phát |

Đã chạy thêm hai lượt audit trên cùng dữ liệu đóng:

| Lượt | Feature bật | Feature thực sự phát | Bar / series so sánh | Sai lệch |
|---|---:|---:|---|---:|
| Cấu hình chart ban đầu | 9 ID | 7 ID | 293 / 19338 | 0 |
| Bật toàn bộ, giữ ngưỡng mặc định | 33 ID | 28 ID | 293 / 19338 | 0 |
| Bật toàn bộ, ngưỡng audit thấp hơn | 33 ID | 33 ID | 293 / 19338 | 0 |

Lượt ngưỡng audit chỉ để quan sát các nhánh hiếm, **không phải tối ưu chiến
lược hoặc ngưỡng được đề xuất để giao dịch**. Các thay đổi tạm thời chính xác:

| Tham số | Ban đầu | Audit |
|---|---:|---:|
| MinimalImbalanceVolume | 10 | 1 |
| ImbalanceClusterSize | 3 | 2 |
| RatioBoundsHigh | 30 | 1.5 |
| DeltaBreakoutThreshold | 200 | 1 |
| RestingLiquidityThreshold | 200 | 1 |
| VerticalLiquidityThreshold | 250 | 1 |
| VerticalLiquidityClusterSize | 3 | 2 |

Năm feature chưa phát ở ngưỡng mặc định đã phát và khớp ở lượt audit:
Stacked Imbalance 181 bar, Ratio Exhaustion 53, Delta Breakout 33, Resting
Liquidity 128, Vertical Liquidity 285. Vì vậy cả 33 ID đã có ít nhất một nhánh
phát thực tế được so đúng giá/validity trong một trong các lượt này. Không
suy ra mọi tổ hợp filter, mọi hướng Buy/Sell hoặc diễn biến intrabar đều đã
được chứng nhận.

Các raw export/report nằm trong thư mục Temp cục bộ; không đưa dữ liệu runtime
đó vào source/fixture. Report tổng hợp có tên `of7-native-comparison-latest.json`,
`of7-native-comparison-all-features.json`, `of7-native-comparison-sensitivity.json`.
DLL của hãng vẫn giữ nguyên hash ban đầu. Đã xuất lại sau khôi phục và so đủ
100 tham số numeric/boolean với baseline: không có giá trị nào khác.

Unfinished Business được xử lý riêng trong `unfinished.py` và trường snapshot
`unfinished_business`, không tăng số lượng feature ID. Đã đối chiếu state
private của lớp base cho các origin nằm trong đoạn capture: 58 line finalized,
0 line open ở cuối đoạn; giá, phía và bar kết thúc đều khớp. Line được tạo
trước đoạn capture và visibility/rendering không nằm trong phép so này. Report
cuối có tên `of7-native-comparison-restored.json`.

Bộ so sánh offline:

```powershell
cd backend
.venv\Scripts\python.exe -m app.orderflow7.nt_compare <audit.json> --mode historical-fast
```

Chọn `realtime` khi biết kết quả được đánh giá theo index realtime. Công cụ
không tự chọn mode cho ra ít sai lệch hơn. Nó kiểm tra validity và mức giá
series, giữ phạm vi enabled/triggered, bỏ warmup thiếu dữ liệu và trả mã lỗi
nếu không có bar so sánh được. Dữ liệu native capture không tự trở thành
dataset ML vì timestamp/provenance còn phải chuẩn hóa riêng.

## Kiểm tra và ranh giới còn lại

Đợt kiểm tra cuối: 196 test qua, gồm OF7 mới và các test footprint/SMC cũ,
property tests dùng 100 examples. Comparator có 22 test trong tổng này.

Các phần còn cần dữ liệu thực bổ sung: các hướng/nhánh và tổ hợp filter chưa
xuất hiện, intrabar xuất hiện/mất tín hiệu, volume reconciliation ở NT processor,
session template, lifecycle các zone và quy tắc hiển thị line. State Unfinished
Business đã được triển khai và đối chiếu như trên. Lõi thuần Python đã
tách khỏi broker/backend live để tiếp tục kiểm chứng mà không đổi dữ liệu
chart dùng hằng ngày. Kế hoạch ML auto-trade chưa được triển khai trong bước này.
