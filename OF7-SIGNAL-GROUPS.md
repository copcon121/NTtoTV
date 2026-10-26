# Phân nhóm OF7 theo dữ liệu đo được và sửa cách diễn giải

Đối chiếu ngày 25/10/2026 với bản phân tích người dùng gửi và
[báo cáo logic DLL](OrderFlowsTrader7_Full_Signal_Logic.md). Mốc của báo cáo là
`OrderFlowsTrader.dll` 7.0.1.0, SHA-256
`d47bbcfad05978a3864297e6a569f99be736984ac474c58ab31065e4a4f07cce`.
Các công thức dưới đây mô tả mốc phân tích đó; phần xác nhận lại mã và runtime
trong NinjaTrader cần được đọc cùng kết quả đối chiếu của lần làm việc này.

Đối chiếu lại DLL trong lần làm việc này sửa hai chi tiết của báo cáo ban đầu:
cờ cực trị phiên cũng chấp nhận **bằng cực trị**, không chỉ phá cực trị mới;
cửa sổ swing chung dùng **GlobalLookBackPeriod + 1**. Các gate/warmup riêng
của detector phải theo mã đã đối chiếu, không suy ra một gate chung từ bảng
trigger rút gọn bên dưới.

## Cách đọc và đếm

OFT7 có **29 method detector chính và 33 feature/output ID**. Số 32 trong bản
người dùng gửi là số thứ tự trình bày: Prominent POC gộp ba level thành một mục,
Ratio tách thành hai mục, còn Unfinished Business được tính thêm dù thuộc lớp
base/renderer. Vì vậy không dùng số 32 như số lượng detector hoặc feature ID.

Một feature thường có nhiều series Buy/Sell, và có thể có nhiều zone trên một
bar. Value Area có hai output mức giá Low/High nhưng vẫn là một feature ID.
Số method, số feature, số series, số zone và số tín hiệu hoạt động là các đại
lượng khác nhau.

Phân nhóm “đảo chiều”, “tiếp diễn”, “hấp thụ”, “cạn lực” hữu ích để đặt giả
thuyết nghiên cứu, nhưng không phải kết quả mà detector chứng minh. Để chuẩn bị
dữ liệu ML, nhóm chính phải mô tả phép đo. Mỗi feature có thể có nhiều tag phụ;
tag không phải nhãn kết quả giá tương lai.

| Nhóm | Phép đo chính | Cách sử dụng đúng |
|---|---|---|
| G1 — Quan hệ nến và Delta | Dấu, phân bố hoặc thay đổi Delta | Đo sự phù hợp/xung đột; kiểm tra sau đó giá tiếp diễn hay thất bại |
| G2 — Hình dạng volume tại cực trị | Cell cực trị, tỷ số hai cell, gradient ba cell | Mô tả hình dạng; hấp thụ/cạn lực vẫn là giả thuyết |
| G3 — Phân bố imbalance | Tỷ lệ chéo, số lượng, cụm, sự lặp lại | Phân biệt phía aggressor và màu nến; không đồng nhất aggressor với hướng giá kế tiếp |
| G4 — Phân bố volume theo mức giá | Cell mỏng, gradient, cell lớn hoặc lặp lại | Đo giao dịch đã khớp; không suy ra thời gian quét hoặc lệnh chờ |
| G5 — Vị trí và dịch chuyển POC | POC cực trị, trùng hoặc thay đổi giữa các nến | Đo vùng tập trung khối lượng; phản ứng sau retest cần quan sát riêng |
| G6 — Hình học Value Area | VA hiện tại, engulf hoặc khoảng giữa hai VA | Đo phân bố giá trị theo volume; chấp nhận/từ chối cần định nghĩa bổ sung |

## Bản đồ đủ 33 feature ID

Ký hiệu: `U = Open < Close`, `D = Open > Close`, `d = 1 ladder tick`,
`Delta = Ask - Bid`. Buy/Sell bên dưới là hướng zone/mẫu theo quy ước detector,
không phải lệnh giao dịch. Doji không thuộc U hoặc D. Các công thức thể hiện
trigger cốt lõi; enable, warmup, swing filter và dữ liệu cell hợp lệ vẫn phải
được áp dụng theo từng detector.

### G1 — Quan hệ nến và Delta: 5 ID

| Feature ID | Trigger Buy cốt lõi theo mốc báo cáo | Sell tương ứng / tag phụ |
|---|---|---|
| `delta_divergence` | U và Delta > 0; mặc định Low tại cực trị trading day, có nhận equality | D, Delta < 0, mặc định High tại cực trị, có nhận equality; cực trị phiên |
| `price_action_divergence` | U và Delta < 0 | D và Delta > 0; giả thuyết hấp thụ |
| `delta_tail` | U; Delta[Low] < 0 và tất cả cell còn lại Delta > 0 | D; Delta[High] > 0 và tất cả cell còn lại < 0; hình dạng cực trị |
| `market_weakness` | U; N Delta âm và tăng nghiêm ngặt về 0, mặc định N=3 | D; N Delta dương và giảm nghiêm ngặt về 0; chuỗi liên bar |
| `delta_breakout` | Hai bar U; cả hai Delta > 0; Delta(t)-Delta(t-1) >= 200 | Hai bar D; cả hai Delta < 0; hiệu <= -200; tăng tốc liên bar |

`delta_divergence` trong OF7 không so hai swing của giá với hai swing của
Delta/CVD. Khi tắt daily filter, trigger chỉ là **màu nến cùng dấu Delta**.
Không đổi tên một classic CVD divergence thành feature này và không dùng hai
khái niệm thay thế nhau.

Khi bật daily filter, việc chạm lại đúng cực trị phiên cũng có thể qua cờ
cực trị; không bắt buộc phá mức cũ một tick. `price_action_divergence` dùng
cùng loại cờ khi bật tùy chọn daily high/low.

`market_weakness` kiểm tra cả N dấu Delta, nhưng chỉ yêu cầu màu nến hiện tại.
Không tự thêm yêu cầu tất cả N nến cùng màu. `delta_breakout` không kiểm tra
giá vượt High/Low trước hoặc BOS. Hai điều kiện đó là context riêng của SMC.

Trường hợp biên của DLL: với `N=1`, vòng so sánh Market Weakness không chạy,
nên dấu Delta cũng không được kiểm tra. Không dùng mô tả N=3 để suy ra hành vi
của mọi cấu hình N. Gate riêng `barIndex - 1 >= N` vẫn phải thỏa.

### G2 — Hình dạng volume tại cực trị: 7 ID

| Feature ID | Trigger Buy cốt lõi theo mốc báo cáo | Sell tương ứng / tag phụ |
|---|---|---|
| `tails` | U; Ask[Low] = Ask[Low+d] = 0 | D; Bid[High] = Bid[High-d] = 0; hai cell cực trị |
| `exhaustion_prints` | U; 0 < Bid[Low] <= 9 | D; 0 < Ask[High] <= 9; volume tuyệt đối nhỏ |
| `ratio_price_defense` | U; Bid[Low+d]/Bid[Low] < 0.69 | D; Ask[High-d]/Ask[High] < 0.69; tỷ lệ tương đối |
| `ratio_price_exhaustion` | U; cùng tỷ lệ > 30 | D; cùng tỷ lệ > 30; tỷ lệ tương đối |
| `zero_print` | U; Bid[Low] = 0 hoặc Bid[Low+d] = 0 | D; Ask[High] = 0 hoặc Ask[High-d] = 0; cell zero |
| `volume_decline` | U; Bid[Low] < Bid[Low+d] < Bid[Low+2d] | D; Ask[High] < Ask[High-d] < Ask[High-2d]; gradient cực trị |
| `retail_suck` | U; Bid[Low] > Bid[Low+d] > Bid[Low+2d] | D; Ask[High] > Ask[High-d] > Ask[High-2d]; gradient cực trị |

Tails và Zero Print nhìn **khác phía volume** trên cùng một loại nến.
Ví dụ trên U, Tails nhìn Ask ở đáy, còn Zero Print nhìn Bid ở đáy. Không gộp
chúng thành một feature “zero tại extreme”. Exhaustion Prints loại volume 0;
Zero Print lại cần đúng 0.

Các tỷ lệ dùng bất đẳng thức nghiêm ngặt: đúng 0.69 hoặc đúng 30 không thỏa
hai nhánh trên. Tỷ lệ thấp không bắt buộc mẫu số là volume lớn: 1/2 cũng
cho 0.5. Tỷ lệ cao không tự chứng minh volume ở cực trị nhỏ về tuyệt đối:
31000/1000 vẫn cho 31. Do đó lưu cả tử số, mẫu số và tỷ lệ để nghiên cứu.

DLL đặt tỷ lệ bằng 0 khi mẫu số 0. Đây là output compatibility có thể rơi vào
Defense, nhưng **không đủ dữ liệu để suy luận phòng thủ/hấp thụ**. Lưu hành vi
gốc và đánh dấu độ hợp lệ diễn giải riêng; thêm filter mẫu số > 0 là một biến
thể nghiên cứu, không phải khẳng định DLL gốc đã dùng filter đó.

### G3 — Phân bố imbalance: 5 ID

| Feature ID | Trigger Buy cốt lõi theo mốc báo cáo | Sell tương ứng / tag phụ |
|---|---|---|
| `imbalance_reversal` | U; Bid imbalance tại Low hoặc Low+d | D; Ask imbalance tại High hoặc High-d; cực trị, ngược màu nến |
| `inverse_imbalance` | U; >=2 Bid imbalances liên tiếp | D; >=2 Ask imbalances liên tiếp; cụm ngược màu nến |
| `stacked_imbalance` | U; >=3 Ask imbalances liên tiếp | D; >=3 Bid imbalances liên tiếp; cụm cùng màu nến |
| `multiple_imbalances` | U; tổng >=3 Ask imbalances | D; tổng >=3 Bid imbalances; không bắt buộc liền nhau |
| `imbalance_reload` | Hai U; cùng mức giá có Ask imbalance trong cả hai bar | Hai D và Bid imbalance; lặp lại liên bar |

Ask imbalance tại `p` so `Ask[p]` với `Bid[p-d]`; Bid imbalance so
`Bid[p]` với `Ask[p+d]`. Mốc mặc định là tỷ lệ >=4 và volume phía đang xét
>=10. Cell chéo phải tồn tại; cell vắng không tự động trở thành cell có volume
0. Bộ min volume của Imbalance Reversal là tham số riêng.

Stacked và Multiple có thể cùng xuất hiện: ba imbalance liên tiếp cũng là ba
imbalance tổng cộng. Chúng không phải hai bằng chứng độc lập về lực mua/bán.
Reload xác nhận lặp lại **tại cùng mức giá**, không xác nhận cùng order ID hay
cùng tổ chức. Imbalance Reversal/Inverse không quan sát vị thế hoặc P&L của
người tham gia, nên “trapped traders” chỉ là giả thuyết.

### G4 — Phân bố volume theo mức giá: 6 ID

| Feature ID | Trigger Buy cốt lõi theo mốc báo cáo | Sell tương ứng / tag phụ |
|---|---|---|
| `market_sweep` | U; cụm >=3 cell liên tiếp có Bid <=5 | D; cụm Ask <=5; volume phía đối diện thấp |
| `thin_prints` | U; cell bên trong ladder có Bid <=1 | D; cell bên trong có Ask <=1; từng cell, không cần cụm |
| `orderflows_sequencing` | U; Ask tăng nghiêm ngặt theo giá từ thấp lên cao, cụm >=5 | D; Bid giảm nghiêm ngặt theo chiều duyệt đó; gradient không gian |
| `vertical_liquidity` | U; >=3 cell Ask liên tiếp đều >=250 | D; cụm Bid >=250; volume đã khớp lớn |
| `resting_liquidity` | Hai U; cùng mức p có Ask >=200 ở cả hai bar; chọn p có Ask hiện tại lớn nhất | Hai D và Bid; lặp lại liên bar |
| `accumulation_distribution` | So Bid tại Bid POC với Ask tại Ask POC và passive filter; nhánh Buy có OR bất đối xứng | Nhánh D yêu cầu Ask tại Ask POC > Bid tại Bid POC; tag POC, xung đột nến/volume |

Không gọi nhóm này là “động lượng/breakout đã xác nhận”. Market Sweep không
đo tốc độ hay kích thước một lệnh quét. Sequencing là volume tăng/giảm theo
**thứ tự mức giá**, không phải thứ tự thời gian. Vertical/Resting Liquidity
không đọc lượng limit order còn chờ trong DOM. Thin Prints bỏ hai cell đầu
cuối ladder; multiple thin prints là điều kiện vẽ viền, không phải feature ID
mới.

Các bảng trên rút gọn theo ladder đầy đủ. DLL thực sự duyệt key đã giao dịch:
Market Sweep và Sequencing đo độ dài bằng khoảng giá; cluster Vertical và
Imbalance đếm các key liên tiếp trong thứ tự duyệt, không tự chèn mọi giá bị
khuyết. Sequencing bỏ row làm đứt chuỗi, không dùng ngay nó làm đầu chuỗi mới.
Các detector đọc trực tiếp `XArray[p]` có thể nhận row zero cho giá thiếu,
trong khi Zero Print và imbalance kiểm tra key tồn tại. Đây là khác biệt dữ
liệu quan trọng, không thay thế mọi giá thiếu bằng zero trong dataset.

Accumulation/Distribution cần trình bày đầy đủ hai nhánh, không chỉ tên gọi:

```text
Sell trên D:
  askAtAskPOC > bidAtBidPOC
  AND (NOT PassiveTradersInControl OR secondHighestAsk > bidAtBidPOC)

Buy trên U, theo biểu thức bất thường của DLL:
  bidAtBidPOC > askAtAskPOC
  OR NOT PassiveTradersInControl
  OR secondHighestBid > askAtAskPOC
```

Với passive filter tắt, **mọi nến U vượt các gate chung** đều thỏa nhánh Buy,
không chỉ “phần lớn” nến U. Ngay cả khi bật passive filter, biểu thức Buy là OR,
không tự trở thành bản đối xứng AND của Sell. Muốn sửa phải giữ lại phép tính
gốc để so sánh và đặt tên/version riêng cho biến thể đã sửa.

### G5 — Vị trí và dịch chuyển POC: 7 ID

| Feature ID | Trigger Buy cốt lõi theo mốc báo cáo | Sell tương ứng / tag phụ |
|---|---|---|
| `prominent_poc_level_1` | U; POC tại Low; mặc định lookback=0 | D; POC tại High; vị trí cực trị |
| `prominent_poc_level_2` | U; POC cách Low <=1 tick; lookback=0 | D; POC cách High <=1 tick |
| `prominent_poc_level_3` | U; POC cách Low <=2 tick; Low <= min Low ba bar trước | D; High >= max High ba bar trước |
| `poc_slingshot` | Hai U; POC(t) < POC(t-1) | Hai D; POC(t) > POC(t-1); nến và POC khác hướng |
| `poc_wave` | A D, B U, C U; POC(B) < POC(A) < POC(C) | A U, B D, C D; POC(B) > POC(A) > POC(C); mẫu ba bar |
| `open_poc` | U; POC > max High cửa sổ năm bar trước | D; POC < min Low cửa sổ trước; ngoài range cũ |
| `aligned_poc` | U; POC(t) = POC(t-1) | D với POC bằng nhau; không cần nến trước cùng màu |

Prominent POC duyệt Level 1 rồi 2 rồi 3 và **dừng sau tín hiệu đầu tiên**.
Ba level không phải ba phiếu đồng thuận độc lập trên cùng bar. Các khoảng
cách ở bảng là giá trị hiệu lực mặc định; setting distance gốc là 1/2/3 và
code so khoảng cách <=setting-1. Nếu đổi cấu hình phải tính lại cả lookback
lẫn check cell Delta theo từng level.

POC là vị trí có tổng volume lớn nhất, không phải tổng volume của cả nến.
Trong OF7 tổng này gồm Bid + Ask + Between. Hai nến xanh chỉ cho biết từng
Close > Open; không bảo đảm Close(t) > Close(t-1), cũng không bảo đảm giá đang
tạo higher high. Vì vậy câu “giá tiếp tục tăng nhưng POC giảm” ở Slingshot
cần sửa thành “hai nến đều xanh nhưng POC sau thấp hơn”.

Aligned POC chỉ xác nhận cùng vị trí POC, chưa đủ để gọi thị trường cân bằng.
Open POC nằm ngoài range cửa sổ trước là điều kiện định lượng mạnh hơn màu
nến, nhưng “breakout thành công” vẫn là kết quả tương lai cần đo.

### G6 — Hình học Value Area: 3 ID

| Feature ID | Phép đo/trigger theo mốc báo cáo | Tag phụ và giới hạn |
|---|---|---|
| `value_area` | Tính VAL/VAH; mở rộng từ POC tới mục tiêu mặc định 70% volume | Output mức giá; U/D chỉ quyết định phía zone, doji neutral |
| `engulfing_value_area` | VAH(t)>VAH(t-1) và VAL(t)<VAL(t-1); U gán Buy, D gán Sell | Mở rộng cả hai phía; không nhất thiết dịch chuyển lên hoặc xuống |
| `orderflows_gaps` | U và VAL(t)>VAH(t-1)+d; Sell D và VAH(t)<VAL(t-1)-d | Khoảng giữa hai VA; khác FVG ba nến |

VA thường đạt **ít nhất** tỷ lệ mục tiêu và có thể vượt 70% khi thêm nguyên
cell. Không phải mọi thuật toán VA đều cho cùng kết quả khi có hòa volume,
ladder thưa hoặc POC đổi. Phải đối chiếu đúng thuật toán của artifact này.

Vùng giữa hai Value Area không đồng nghĩa vùng chưa từng có giao dịch.
Hai full ranges có thể chồng lấn trong khi hai VA tách nhau. Do đó không gọi
Orderflows Gaps là “gap không có trade” hoặc thay nó bằng SMC FVG. Chấp nhận
giá mới, từ chối giá cũ và retest thành công đều cần định nghĩa quan sát riêng.

## Unfinished Business: giữ riêng với 33 ID

Theo báo cáo lớp base: U và Bid[High]>0 tạo line tại High; D và Ask[Low]>0
tạo line tại Low. Các bar sau có thể kết thúc line khi xuyên qua mức đó.
Đây là phép đo cực trị và vòng đời line, không phải một feature Buy/Sell mới
trong 33 ID của OrderFlowsTrader. Không coi một unfinished level là bảo đảm
giá sẽ quay lại.

Đã kiểm tra lớp base: state được cập nhật khi bar đóng, ngay cả khi toggle
hiển thị tắt. High line chỉ finalize nếu High của một bar đóng sau đó **lớn
hơn** giá line; Low line cần Low **nhỏ hơn**. Chạm bằng không finalize. Xử lý
line cũ trước, rồi mới tạo line của bar hiện tại; bar gốc index 0 không được
track bởi caller có gate CurrentBar>1. Swing filter ở renderer là quy tắc
hiển thị riêng. `unfinished.py` đã tái tạo state và so khớp 58 line được tạo
trong đoạn native capture, gồm giá, phía và bar kết thúc.

## Những câu cần sửa trong bản phân nhóm ban đầu

| Nội dung ban đầu | Sửa thành | Lý do |
|---|---|---|
| Delta Tail: “ban đầu bán ở đáy, sau đó mua giành quyền kiểm soát” | Delta tại đáy trái dấu các cell còn lại; chưa biết thứ tự giao dịch | Footprint tổng hợp theo giá mất thứ tự thời gian |
| Sequencing: volume gia tăng “khi giá đi lên” | Gradient volume theo mức giá; tốc độ và thứ tự khớp chưa được kiểm tra | Duyệt giá từ thấp lên cao không tái dựng đường đi tick |
| Volume Decline/Retail Suck mô tả lực giảm/tăng dần theo thời gian | Gradient ba cell tại một snapshot | Thay đổi theo trục giá khác thay đổi theo trục thời gian |
| Delta Divergence là phân kỳ giá/Delta thông thường | Tên riêng của OF7: dấu nến cùng dấu Delta, thường thêm cực trị trading day | Không có phép so divergence hai swing |
| Daily high/low bắt buộc tạo mức mới | Equality tại cực trị phiên cũng được nhận trong DLL đối chiếu lại | “Tạo mới” bỏ sót trường hợp chạm lại cùng giá |
| Nhóm 1 là đảo chiều, nhóm 2 là breakout | Đây là tag giả thuyết có thể chồng lấn | Cùng mẫu có thể tiếp diễn hoặc thất bại tùy context |
| Ratio Defense đồng nghĩa nhiều volume bị hấp thụ | Tỷ số thấp; phải giữ volume tuyệt đối và kiểm tra dữ liệu | Tỷ số không cung cấp quy mô hay vị thế đối tác |
| Ratio Exhaustion đồng nghĩa cực trị có rất ít volume | Tỷ số cao; chưa có ngưỡng tuyệt đối cho mẫu số | Một mẫu số lớn vẫn có thể tạo tỷ số >30 |
| Không bật “cả 32 nhóm” | Thu thập đủ 33 feature ID, phân nhóm bằng metadata; lựa chọn mô hình làm sau | Tránh mất tín hiệu gốc trước khi đánh giá |
| Chỉ đánh giá nến đóng để hết repaint | Lưu riêng provisional và finalized; quyết định dùng loại nào phải khớp thời điểm thực tế | Bỏ hết intrabar sẽ mất diễn biến cần cho ML theo dõi sau CHoCH/BOS |

Ví dụ Delta Tail không đủ để chứng minh chuỗi thời gian: một bar có thể
giao dịch ở các mức trên trước, sau đó xuống Low, rồi quay lên, hoặc đi qua
các mức nhiều lần, nhưng vẫn có cùng OHLC và tổng Delta từng cell. Muốn xác
nhận “hấp thụ rồi chuyển quyền kiểm soát” cần tick stream hoặc snapshot có
`observed_at`, cùng quy tắc định lượng cho hấp thụ và chuyển quyền kiểm soát.

Các câu “đáng nghiên cứu”, “ưu tiên GC”, hoặc lựa chọn setup trong bản gửi là
ý tưởng nghiên cứu. Chưa có thống kê so sánh trên cùng tập dữ liệu để nâng
chúng thành bảng xếp hạng dự báo. Phần này không sửa công thức OF7 theo một
ý nghĩa giao dịch được kỳ vọng sẵn.

## Quy tắc cho code và dữ liệu trước bước ML

1. Giữ ba lớp riêng: **output gốc theo artifact**, **hướng/độ hợp lệ đã chuẩn
   hóa**, và **giả thuyết phản ứng giá**. Không sửa im lặng output compatibility
   chỉ để biểu đồ dễ hiểu hơn.
2. Với Tails, bearish Sequencing và bearish Zero Print, lưu tên series gốc và
   hướng zone riêng. Không lấy từ “Buy” trong tên làm direction duy nhất.
3. Lưu số đo liên tục bên cạnh boolean/count: volume, Delta, giá trị ratio,
   numerator/denominator, khoảng cách POC, số lượng/độ dài imbalance. Hai
   feature phụ thuộc cùng ladder không phải quan sát độc lập.
4. Dữ liệu thiếu cell/Between, nguồn thay đổi, thiếu đầu phiên, warmup chưa đủ
   và bar còn chạy phải có cờ chất lượng. Vắng dữ liệu không giống volume 0;
   feature chưa thể đánh giá không giống feature được đánh giá là false.
5. Giá series, giá zone và tọa độ mũi tên là các giá trị khác nhau. Đọc series
   phải kiểm tra validity; Value Area Low/High không đọc qua getter key sai.
6. Giữ `bar_start`, `observed_at`, trạng thái đóng nến, nguồn, hợp đồng thật,
   session template, parameter hash và phiên bản thuật toán. Không gán thời
   điểm một pivot cũ thành thời điểm CHoCH/BOS được biết.
7. Lưu toàn bộ feature đã tính đúng để nghiên cứu; không loại feature chỉ vì
   tên nhóm của nó không phù hợp với giả thuyết đảo chiều/tiếp diễn ban đầu.
   Nhãn tương lai và phương án auto-entry được thiết kế ở bước tiếp theo.

Các điểm thuật toán còn cần bằng chứng từ DLL/replay gồm quy tắc phá hòa cuối
của POC/VA, cập nhật Bid POC theo thứ tự tick, các gate/warmup dùng chung,
swing offset, flush cụm Bid cuối ladder và vòng đời zone/Unfinished Business.
Việc có unit test đúng công thức trong báo cáo không tự xác nhận những phần
chưa có oracle runtime. Bản phân nhóm này hoàn chỉnh về ánh xạ 33 ID; trạng
thái xác nhận từng thuật toán phải theo kết quả đối chiếu mã/replay riêng.
