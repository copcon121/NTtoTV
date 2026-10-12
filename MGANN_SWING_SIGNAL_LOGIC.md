# Logic signal MGannSwing: PB / # / SP / UT

Tài liệu này mô tả logic đang được triển khai trong frontend tại
[`frontend/src/chart/mgannSwing.ts`](frontend/src/chart/mgannSwing.ts), cách đọc
signal live/confirmed và một số ví dụ sử dụng thực tế.

## 1. Nền tảng: swing Internal-5

MGannSwing sử dụng pivot Internal-5 cố định:

- Pivot high phải cao hơn 5 nến bên trái và không thấp hơn 5 nến bên phải.
- Pivot low phải thấp hơn 5 nến bên trái và không cao hơn 5 nến bên phải.
- Nếu có hai pivot liên tiếp cùng loại, pivot cực trị hơn sẽ thay thế pivot cũ.
- Một pivot chỉ được confirm sau khi đủ 5 nến đóng bên phải.

Mỗi wave là đoạn nối giữa hai pivot liên tiếp. Hệ thống tính cho mỗi wave:

- `length`: độ dài tuyệt đối của chuyển động giá.
- `width`: số nến giữa hai pivot.
- `volume`: tổng volume từ sau pivot bắt đầu đến pivot kết thúc.
- `delta`: tổng `closeDelta` trên cùng khoảng đó.
- `volume / width` và `delta / width`: effort trung bình trên mỗi nến.

Signal cần tối thiểu khoảng 6 pivot để có đủ các wave cùng hướng trước đó cho
việc so sánh.

## 2. Live và confirmed

Hệ thống giữ hai phần riêng biệt:

- Swing đã confirm được vẽ nét liền.
- Swing kế tiếp đang phát triển được vẽ nét đứt.

Signal trên swing developing được tính lại từ OHLC, volume và volume delta
realtime, với nhịp render tối đa khoảng 500 ms/lần.

Signal live có các đặc điểm:

- Màu nhạt hơn signal confirmed.
- Có thể thay đổi label, dịch sang pivot cực trị hơn hoặc biến mất.
- Không nên được hiểu là một lệnh giao dịch đã xác nhận.

Khi pivot quyết định signal có đủ 5 nến đóng bên phải:

- Đoạn swing tương ứng chuyển từ nét đứt sang nét liền.
- Signal chuyển từ live sang confirmed và dùng màu rõ hơn.

Lưu ý riêng cho `SP` và `UT`: marker nằm trên pivot trước, nhưng trạng thái xác
nhận phụ thuộc vào pivot đối diện kế tiếp. Vì vậy marker có thể nằm ở một đáy
hoặc đỉnh cũ trong khi đoạn nét đứt đang phát triển ở phía sau nó.

## 3. Cách đọc màu và vị trí

| Hiển thị | Cách đọc |
|---|---|
| Marker dưới pivot low, màu xanh | Bullish hoặc Buy-side candidate |
| Marker trên pivot high, màu đỏ | Bearish hoặc Sell-side candidate |
| Màu nhạt + swing nét đứt | Live, chưa confirm, có thể repaint |
| Màu rõ + swing nét liền | Đã confirm theo Internal-5 |
| `[#]` hoặc `[PB]` | Signal có thêm điều kiện chuỗi close của các pivot |

## 4. Signal `#`: suy yếu qua nhiều wave

`#` tìm sự suy giảm liên tiếp trong ba wave cùng hướng. Chỉ cần điều kiện
volume **hoặc** điều kiện delta thỏa mãn.

### Điều kiện volume

```text
Volume wave hiện tại
    <= volume wave cùng hướng trước
    <= volume wave cùng hướng trước nữa
```

### Điều kiện delta

Với wave tăng:

```text
Delta hiện tại <= delta trước <= delta trước nữa
```

Với wave giảm:

```text
Delta hiện tại >= delta trước >= delta trước nữa
```

Với wave giảm, delta thường là số âm. Ví dụ:

```text
-200 >= -500 >= -800
```

Điều này cho thấy selling delta đang yếu dần. Nếu delta đổi dấu, nên đọc đúng
quan hệ số học thay vì chỉ nhìn độ lớn tuyệt đối.

### Đặc điểm

- `#` tại pivot high: wave tăng đang mất participation, thiên về bearish.
- `#` tại pivot low: wave giảm đang mất participation, thiên về bullish.
- Đây là tín hiệu exhaustion/divergence, không bảo đảm đảo chiều ngay.
- Signal có thể xuất hiện do volume suy yếu dù delta chưa suy yếu, hoặc ngược
  lại.

### Ví dụ bearish

```text
Ba wave tăng liên tiếp:

Volume: 1,400 -> 1,050 -> 700
Delta:   +800 ->  +420 -> +100
```

Giá vẫn đi tới một pivot high nhưng lực tham gia giảm rõ rệt. `#` trên pivot
high là cảnh báo không nên đuổi Long và có thể bắt đầu tìm xác nhận Sell.

### Ví dụ bullish

```text
Ba wave giảm liên tiếp:

Delta: -900 -> -520 -> -180
```

Giá đi xuống pivot low nhưng lực bán yếu dần. `#` dưới pivot low cảnh báo seller
exhaustion và khả năng hình thành phản ứng tăng.

## 5. Signal `PB`: effort lớn nhưng price result kém

`PB` so sánh wave hiện tại với wave cùng hướng ngay trước đó.

Các điều kiện chính:

1. Pivot hiện tại không vượt được pivot cùng loại trước theo close.
2. Độ dài wave hiện tại không lớn hơn wave cùng hướng trước.
3. Pivot bar hiện tại nằm hoàn toàn về phía yếu hơn so với pivot bar cùng loại
   trước.
4. Dù price result kém hơn, ít nhất một thước đo effort vẫn mạnh hơn:
   - Volume trung bình mỗi nến lớn hơn.
   - Tổng volume lớn hơn.
   - Delta trung bình mỗi nến thể hiện effort mạnh hơn nhưng không tạo được
     tiến triển giá.
   - Tổng delta thể hiện effort mạnh hơn nhưng không tạo được tiến triển giá.

Ý tưởng cốt lõi:

```text
Effort lớn hơn + kết quả giá kém hơn
=> có thể đang xảy ra absorption hoặc mất hiệu quả
```

### Bullish PB

Với một wave giảm hiện tại:

- Close tại low hiện tại không thấp hơn close tại low trước.
- Low của pivot bar hiện tại nằm trên high của pivot bar low trước.
- Wave giảm hiện tại ngắn hơn hoặc bằng wave giảm trước.
- Volume lớn hơn hoặc delta ít bearish/more positive hơn.

Ví dụ:

```text
Wave giảm trước: dài 10 điểm, volume 800, delta -500
Wave giảm mới:    dài  6 điểm, volume 1,100, delta -100
```

Seller bỏ nhiều effort hơn nhưng không đẩy giá xuống được. `PB` dưới pivot low
là bullish candidate.

### Bearish PB

Điều kiện đối xứng:

- Wave tăng hiện tại ngắn hơn hoặc bằng wave tăng trước.
- Không vượt được high trước.
- Pivot high hiện tại nằm hoàn toàn thấp hơn pivot high trước.
- Volume mua lớn hơn hoặc delta mua mạnh hơn nhưng giá không tiến triển.

`PB` trên pivot high cho thấy buyer có thể đang bị hấp thụ.

## 6. Signal `SP`: Spring

`SP` là signal bullish, được đặt tại pivot low trước đó.

Logic tổng quát:

1. Low mới bằng hoặc thấp hơn vùng low trước: có hành vi sweep xuống.
2. Pivot bar mới overlap pivot bar low trước, hoặc nến ngay trước pivot mới có
   overlap.
3. Leg giảm vào low mới cách pivot đối diện trước ít nhất 3 nến.
4. Selling delta của leg giảm mới yếu hơn leg giảm tương ứng trước đó, xét theo
   tổng delta hoặc delta trung bình mỗi nến.
5. Sau low đó, một swing tăng kế tiếp phải bắt đầu hình thành để signal được
   phát hiện.

### Ví dụ

```text
Low cũ: 2,330.0
Low mới: 2,329.8  (sweep xuống 2 ticks)

Delta leg giảm cũ: -650
Delta leg giảm mới: -170
```

Giá tạo low thấp hơn nhưng seller delta giảm mạnh. Khi swing tăng kế tiếp bắt
đầu hình thành, `SP` được đặt tại `2,329.8`.

### Cách sử dụng

- Ưu tiên khi `SP` xuất hiện sau sweep SSL, support hoặc session low.
- Có thể chờ giá reclaim lại mức vừa sweep.
- Xác nhận tốt hơn khi giá break microstructure high hoặc có rejection candle.
- Invalidation thường nằm dưới extreme của Spring cộng một khoảng buffer.
- Nếu giá tiếp tục đóng mạnh dưới vùng support, không nên Buy chỉ vì có `SP`.

## 7. Signal `UT`: UpThrust

`UT` là phiên bản bearish đối xứng với `SP`, được đặt tại pivot high trước đó.

Logic tổng quát:

1. High mới bằng hoặc cao hơn vùng high trước: có hành vi sweep lên.
2. Pivot bar mới overlap pivot bar high trước, hoặc nến ngay trước pivot mới có
   overlap.
3. Leg tăng vào high mới cách pivot đối diện trước ít nhất 3 nến.
4. Buying delta của leg tăng mới yếu hơn leg tăng tương ứng trước đó.
5. Sau high đó, một swing giảm kế tiếp phải bắt đầu hình thành để signal được
   phát hiện.

### Ví dụ

```text
High cũ: 2,365.0
High mới: 2,365.3  (sweep BSL)

Delta leg tăng cũ: +720
Delta leg tăng mới: +160
```

Giá tạo high cao hơn nhưng buying delta yếu đi. Khi swing giảm kế tiếp bắt đầu
hình thành, `UT` được đặt tại `2,365.3`.

### Cách sử dụng

- Ưu tiên khi `UT` nằm trên resistance, BSL, session high hoặc supply.
- Có thể chờ giá đóng trở lại dưới vùng sweep.
- Xác nhận tốt hơn khi giá break microstructure low hoặc có bearish rejection.
- Invalidation thường nằm trên UpThrust extreme cộng một khoảng buffer.
- Nếu giá giữ chắc trên vùng high và delta tiếp tục mở rộng, `UT` có nguy cơ bị
  vô hiệu.

## 8. Ý nghĩa của `[#]` và `[PB]`

Dấu ngoặc không tạo một công thức signal mới. Nó cho biết signal `#` hoặc `PB`
đồng thời thỏa điều kiện chuỗi close của các pivot.

Với wave kết thúc ở high:

```text
Close tại high hiện tại
    <= close tại high trước
    <= close tại high trước nữa

và close tại low gần nhất <= close tại low trước
```

Với wave kết thúc ở low, điều kiện được đảo chiều:

```text
Close tại low hiện tại
    >= close tại low trước
    >= close tại low trước nữa

và close tại high gần nhất >= close tại high trước
```

Nên dùng dấu ngoặc để đọc bối cảnh của chuỗi swing. Không nên tự động xem
`[#]` hoặc `[PB]` là lệnh mạnh hơn nếu chưa kiểm tra vị trí thị trường.

## 9. Smart Filter

Khi `Smart Filter` được bật:

- Signal bullish tại pivot low được giữ nếu close của pivot nằm trên EMA200,
  hoặc ADX14 không lớn hơn 25.
- Signal bearish tại pivot high được giữ nếu close của pivot nằm dưới EMA200,
  hoặc ADX14 không lớn hơn 25.

Cách hiểu:

- Trong trend mạnh: ưu tiên Buy pullback phía trên EMA200 và Sell rally phía
  dưới EMA200.
- Trong range với `ADX14 <= 25`: cho phép signal hai chiều.

Smart Filter chỉ lọc signal. Nó không thay đổi cách xác định pivot hoặc wave.

## 10. Quy trình sử dụng thực tế

1. Xác định vị trí của signal so với support/resistance, BSL/SSL, session
   high/low và vùng supply/demand.
2. Dùng signal live như cảnh báo sớm, không coi là lệnh đã xác nhận.
3. Kiểm tra hướng và chất lượng volume delta tại pivot.
4. Chờ rejection candle, reclaim hoặc microstructure break nếu cần xác nhận
   sớm hơn Internal-5.
5. Nếu giao dịch signal live, dùng risk nhỏ hơn và đặt invalidation ngoài pivot
   extreme.
6. Nếu chờ signal confirmed, nhớ rằng xác nhận trễ 5 nến; ưu tiên chờ pullback
   hoặc retest thay vì đuổi giá.

## 11. Bảng tóm tắt

| Signal | Ý nghĩa chính | Vị trí marker | Thiên hướng thường gặp |
|---|---|---|---|
| `#` | Volume hoặc delta suy yếu qua ba wave cùng hướng | Pivot high hoặc low hiện tại | Exhaustion hai chiều |
| `PB` | Effort lớn nhưng price result kém | Pivot high hoặc low hiện tại | Absorption/pullback |
| `SP` | Sweep low trong khi selling pressure yếu đi | Pivot low trước | Bullish |
| `UT` | Sweep high trong khi buying pressure yếu đi | Pivot high trước | Bearish |

## 12. Hai phong cách vào lệnh tham khảo

### Aggressive

- Theo dõi signal live màu nhạt và swing nét đứt.
- Chỉ vào khi có thêm rejection/reclaim/microstructure break.
- Risk nhỏ hơn bình thường.
- Chấp nhận signal có thể repaint hoặc biến mất.

### Conservative

- Chờ signal chuyển sang confirmed và swing thành nét liền.
- Không đuổi giá sau 5 nến xác nhận.
- Chờ pullback hoặc retest vùng signal để có tỷ lệ risk/reward tốt hơn.

Các signal trên là công cụ đọc effort-versus-result và cấu trúc swing. Chúng
nên được kết hợp với vị trí thanh khoản, cấu trúc giá và quản trị rủi ro, thay
vì dùng độc lập như lệnh Buy/Sell tự động.
