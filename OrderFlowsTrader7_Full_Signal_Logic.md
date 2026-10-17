# Báo cáo đầy đủ logic tín hiệu Order Flows Trader 7

## 1. Phạm vi và nguồn bằng chứng

Báo cáo này phân tích tĩnh indicator trong:

- DLL: `C:\Users\Administrator\Documents\NinjaTrader 8\bin\Custom\OrderFlowsTrader.dll`
- Assembly/File version: `7.0.1.0`
- Kích thước: `883,200` bytes
- SHA-256: `D47BBCFAD05978A3864297E6A569F99BE736984AC474C58AB31065E4A4F07CCE`
- File `OrderFlowsTrader.cs` cùng thư mục chỉ là wrapper NinjaScript tự sinh; không chứa logic detector.

Kết quả được đối chiếu giữa metadata/CIL của REA và mã C# decompile tĩnh bằng dnSpy. Hai record bằng chứng chính:

- Managed artifact: `ev_aaa553c2d02b36f872aa5335e74100abe844ad1cfc8341f60f1e8d03cf0c8cad`
- Managed members/CIL: `ev_70cc7129c505c96a252e398eef3ec74730e748e8b0ef6f92e6344577be79f87d`

Đây là hành vi quan sát từ artifact đã ship, không phải source gốc và chưa phải kết quả chạy replay trong NinjaTrader. Template/workspace của người dùng có thể ghi đè các giá trị mặc định trong báo cáo.

Indicator có **33 feature/output ID**, được tạo bởi **29 detector chính** trong `DetectZones2()`.

## 2. Pipeline xử lý chung

### 2.1 Thời điểm detector chạy

`IndicatorMallFootprintBase.OnMarketData()` chỉ xử lý event có `MarketDataType == 2` (trong NinjaTrader thường là Last trade):

1. Gửi tick vào `OrderflowProcessorAgg`.
2. Cập nhật footprint/ladder của bar.
3. Gọi `DetectZones2()` sau mỗi tick.

Trong realtime, detector dùng `CurrentBar`, nên tín hiệu ở bar đang chạy được reset và tính lại sau mỗi tick. Vì POC, Delta, Value Area và volume từng cell còn thay đổi, tín hiệu có thể xuất hiện hoặc biến mất trước khi bar đóng.

Khi `FastHistoricalDataProcessing = true` và indicator ở Historical state, chỉ xử lý tại `IsFirstTickOfBar` và dùng `CurrentBar - 1`, tức bar vừa đóng.

### 2.2 Định nghĩa dữ liệu nền

- `IsUpBar`: `Open < Close`.
- `IsDownBar`: `Open > Close`.
- Doji (`Open == Close`) không thuộc hai nhóm trên.
- `Delta = VolumeAsk - VolumeBid`.
- Trade được tính Ask nếu `Price >= Ask && Ask > Bid`.
- Trade được tính Bid nếu `Price <= Bid && Bid < Ask`.
- Trade nằm giữa Bid/Ask được đưa vào `VolumeBetween`, không đi vào Delta.
- Nếu bật `UpDownTickMode`, processor dựng Bid/Ask giả từ hướng thay đổi giá trước khi cập nhật footprint.

### 2.3 POC và Value Area

- `PocPrice` là cell có tổng `Volume = Ask + Bid + Between` lớn nhất.
- Khi hai cell bằng volume, code ưu tiên cell có tổng volume của cụm ba mức giá `(price - 1 tick, price, price + 1 tick)` lớn hơn.
- `PocPriceAsk` và `PocPriceBid` theo dõi POC riêng của Ask/Bid, cũng dùng cụm ba mức để phá hòa.
- Value Area bắt đầu tại POC và mở rộng về phía cell liền kề có volume lớn hơn cho đến khi đạt `ValueAreaInPercent`; mặc định là `70%`.

### 2.4 Diagonal imbalance

Mặc định:

- `ImbalanceInPercent = 400`.
- `MinimalImbalanceVolume = 10`.

Ask imbalance tại giá `p`:

```text
Ask[p] >= minVolume
và tồn tại mức p - 1 tick
và (Bid[p - 1 tick] == 0 hoặc Ask[p] / Bid[p - 1 tick] >= 4.0)
```

Bid imbalance tại giá `p`:

```text
Bid[p] >= minVolume
và tồn tại mức p + 1 tick
và (Ask[p + 1 tick] == 0 hoặc Bid[p] / Ask[p + 1 tick] >= 4.0)
```

`BarLadder.Keys` được giữ trong `SortedList`, nên các detector duyệt mức giá từ thấp lên cao.

### 2.5 Swing filter dùng chung

`GlobalLookBackPeriod = 5`. Với `DetectSwing(barIndex, barData, useLookBack, offset, allowEqual)`:

- Nếu `useLookBack = false`, detector cho qua.
- Nến giảm: kiểm tra High tại `offset` có lớn hơn MAX của cửa sổ cũ hơn hay không.
- Nến tăng: kiểm tra Low tại `offset` có nhỏ hơn MIN của cửa sổ cũ hơn hay không.
- `allowEqual = true` đổi so sánh nghiêm ngặt thành cho phép bằng nhau.

Trừ khi được ghi rõ khác đi, các property `...UseLookBack` không được gán trong SetDefaults nên mặc định .NET là `false`.

### 2.6 Giá trị output và zone

`SetValue()` không ghi boolean. Nó ghi **mức giá tín hiệu** vào public `Series<double>`:

- Buy thường ghi `Low` của bar.
- Sell thường ghi `High` của bar.
- Plot mũi tên được dịch ra ngoài bar bằng `SignalSpacing * LadderTickSize`; đây chỉ là vị trí vẽ, không đổi giá trong public series.

Trước mỗi vòng detect, toàn bộ series của bar mục tiêu được `Reset()`. Vì vậy consumer nên kiểm tra `IsValidDataPointAt()` thay vì chỉ so sánh giá trị với 0.

`ZoneManager2.AddZone()` chỉ thật sự thêm zone nếu `ZoneSize != 0`:

- `Fixed`: kết thúc tại `barIndex + ZoneSize - 1`.
- `UntilTested`: để end index mở và finalize khi giá quay lại kiểm tra zone.

Trong code, `isAsk = true` được sử dụng nhất quán như phía Sell; `false` như phía Buy, ngoại trừ các bất thường được nêu riêng.

## 3. Snapshot cấu hình mặc định

| Feature/output | Enable mặc định | Tham số trigger chính | Draw mode / Zone size |
|---|---:|---|---|
| Accumulation/Distribution | false | PassiveTradersInControl=false | UntilTested / 1 |
| Prominent POC Level 1 | true | lookback=0, POC distance=1 tick, checkDelta=false | UntilTested / 1 |
| Prominent POC Level 2 | true | lookback=0, POC distance=2 ticks, checkDelta=false | UntilTested / 1 |
| Prominent POC Level 3 | true | lookback=3, POC distance=3 ticks, checkDelta=false | UntilTested / 1 |
| Tails | false | Check HH/LL=false, Check EVA=false | Fixed / 1 |
| Delta Divergence | true | OnlyDailyHighLow=true | UntilTested / 1 |
| Exhaustion Prints | false | SizeLimit=9 | UntilTested / 1 |
| Imbalance Reversal | false | MinimalVolume=10 | UntilTested / 1 |
| Inverse Imbalance | false | ClusterSize=2 | UntilTested / 1 |
| Stacked Imbalance | true | ClusterSize=3 | UntilTested / 1 |
| Market Sweep | false | ClusterSize=3, VolumeThreshold=5 | UntilTested / 5 |
| Market Weakness | false | SequenceLength=3 | UntilTested / 5 |
| Orderflows Sequencing | false | ClusterSize=5 | Fixed / 1 |
| Orderflows Ratio Defense + Exhaustion | true | Low=0.69, High=30 | Fixed / **0** |
| POC Slingshot | false | — | UntilTested / 1 |
| Zero Print | false | — | Fixed / 1 |
| Value Area | true | ValueArea=70% | UntilTested / 1 |
| Engulfing Value Area | true | — | UntilTested / 1 |
| Thin Prints | false | MaximumVolume=1, MultipleThreshold=3 | UntilTested / 1 |
| Multiple Imbalances | false | ExtremeImbalanceThreshold=3 | UntilTested / 1 |
| Open POC | false | LookBackBars=5 | UntilTested / 1 |
| Aligned POC | false | — | UntilTested / 1 |
| Orderflows Gaps | false | Khoảng VA phải >1 tick | Fixed / 1 |
| Imbalance Reload | false | Imbalance 400%, min volume 10 | UntilTested / 1 |
| Volume Decline | false | Ba cell ở đầu bar | Fixed / 1 |
| POC Wave | false | Ba bar, swing offset=1 | Fixed / 1 |
| DeltaTail | false | Toàn bộ cell Delta cùng dấu trừ cell extreme | UntilTested / 1 |
| DeltaBreakout | false | Threshold=200 | Fixed / 1 |
| RetailSuck | false | Ba cell ở đầu bar | UntilTested / 1 |
| RestingLiquidity | false | Threshold=200, hai bar cùng hướng | Fixed / 1 |
| VerticalLiquidity | false | ClusterSize=3, Threshold=250 | Fixed / 1 |
| PriceActionDivergence | false | OnlyDailyHighLow=false | Fixed / 1 |

Mặc định đang bật sáu nhóm: Delta Divergence, Orderflows Ratio, ba level Prominent POC, Stacked Imbalance, Value Area và Engulfing Value Area. Nếu tính từng feature ID riêng, tổng số ID bật lớn hơn số nhóm.

## 4. Logic đầy đủ của từng detector

### 4.1 Accumulation / Distribution

Method: `DetectAccumulationDistribution` — token `0x0600103E`.

Điều kiện chung:

- Feature bật.
- `barIndex >= 3`.
- Qua swing filter nếu filter được bật.

Sell trên nến giảm:

```text
askAtAskPOC = Ask volume tại PocPriceAsk
bidAtBidPOC = Bid volume tại PocPriceBid

askAtAskPOC > bidAtBidPOC
và nếu PassiveTradersInControl=true:
    secondHighestAsk > bidAtBidPOC
```

- Zone tại `PocPriceAsk`.
- Output `AccumulationDistributionSell = High`.

Buy trên nến tăng, đúng theo biểu thức trong DLL:

```text
bidAtBidPOC > askAtAskPOC
OR PassiveTradersInControl == false
OR secondHighestBid > askAtAskPOC
```

- Zone tại `PocPriceBid`.
- Output `AccumulationDistributionBuy = Low`.

Hệ quả: với mặc định `PassiveTradersInControl=false`, mọi nến tăng qua các gate chung đều thỏa nhánh Buy. Đây là bất đối xứng thật trong code, không phải diễn giải.

### 4.2 Buying/Selling Tails

Method: `DetectBuyingSellingTails` — token `0x0600104A`.

Gate:

- Feature bật, `barIndex > 0`, qua swing filter.
- Nếu `TailsCheckEva=true`, VA hiện tại phải engulf VA trước: `VAH(t)>VAH(t-1)` và `VAL(t)<VAL(t-1)`.
- Nếu `TailsCheckHhLl=true`, nến giảm phải tạo Higher High; nến tăng phải tạo Lower Low.

Nhánh nến giảm:

```text
Bid[High] == 0
và Bid[High - 1 tick] == 0
```

- Zone `[High-1 tick, High]`, `isAsk=true`.
- DLL ghi **`TailsBuy = High`**.

Nhánh nến tăng:

```text
Ask[Low] == 0
và Ask[Low + 1 tick] == 0
```

- Zone `[Low, Low+1 tick]`, `isAsk=false`.
- DLL ghi **`TailsSell = Low`**.

Nhãn series bị đảo so với hướng zone và quy ước phần còn lại của indicator; xem mục bất thường.

### 4.3 Delta Divergence

Method: `DetectDeltaDivergence` — token `0x0600104B`.

Nếu `DeltaDivergenceOnlyDailyHighLow=true`:

- Buy khi bar đang tạo low mới của trading day, là nến tăng và `Delta > 0`.
- Sell khi bar đang tạo high mới của trading day, là nến giảm và `Delta < 0`.

Nếu `OnlyDailyHighLow=false`:

- Buy: nến tăng và `Delta > 0`.
- Sell: nến giảm và `Delta < 0`.

Zone Buy `[Low, Low+1 tick]`; zone Sell `[High-1 tick, High]`.

Các cờ daily/session được `SessionData.UpdateValues()` tính theo `tradingDay` của NinjaTrader, không phải chỉ dựa vào bar ngay trước.

### 4.4 Price Action Divergence

Method: `DetectPriceActionDivergence` — token `0x0600104C`.

Nếu `PriceActionDivergenceOnlyDailyHighLow=true`:

- Buy: low mới của trading day, nến tăng, nhưng `Delta < 0`.
- Sell: high mới của trading day, nến giảm, nhưng `Delta > 0`.

Nếu `OnlyDailyHighLow=false` — đây là mặc định:

- Buy: nến tăng và `Delta < 0`.
- Sell: nến giảm và `Delta > 0`.

Zone Buy `[Low, Low+1 tick]`; zone Sell `[High-1 tick, High]`.

### 4.5 Exhaustion Prints

Method: `DetectExhaustionPrints` — token `0x0600104D`.

Gate: feature bật, `barIndex >= 3`, qua swing filter, bar có volume và `High != Low`.

- Buy: nến tăng, `0 < Bid[Low] <= ExhaustionPrintsSizeLimit`.
- Sell: nến giảm, `0 < Ask[High] <= ExhaustionPrintsSizeLimit`.
- Zone là một mức tại Low/High.

Mặc định `SizeLimit=9`.

### 4.6 Imbalance Reversal

Method: `DetectImbalanceReversal` — token `0x0600104E`.

- Buy: nến tăng và có Bid imbalance tại `Low` hoặc `Low+1 tick`.
- Sell: nến giảm và có Ask imbalance tại `High` hoặc `High-1 tick`.
- Min volume riêng mặc định `10`; ratio imbalance vẫn lấy từ cấu hình chung 400%.
- Zone rộng hai ticks ở đầu tương ứng của bar.

### 4.7 Market Sweep

Method: `DetectMarketSweep` — token `0x0600104F`.

Duyệt ladder từ thấp lên cao và gom các cell liên tiếp:

- Buy trên nến tăng: cụm Bid volume `<= MarketSweepVolumeThreshold`.
- Sell trên nến giảm: cụm Ask volume `<= MarketSweepVolumeThreshold`.
- Số cell liên tiếp phải `>= MarketSweepClusterSize`.
- Zone bao toàn bộ cụm.

Mặc định là ít nhất ba cell có volume `<= 5`. Detector tìm thanh khoản rất thấp, không phải volume lớn.

### 4.8 Market Weakness

Method: `DetectMarketWeakness` — token `0x06001050`.

Với sequence length `N`:

- Buy: bar hiện tại là nến tăng; N bar trong chuỗi đều có Delta âm; Delta tăng dần theo thời gian về phía 0.
- Sell: bar hiện tại là nến giảm; N bar trong chuỗi đều có Delta dương; Delta giảm dần theo thời gian về phía 0.

Ví dụ Buy ba bar:

```text
Delta(t-2) < Delta(t-1) < Delta(t) < 0
```

Zone Buy tại Low; Sell tại High.

### 4.9 Orderflows Sequencing

Method: `DetectOrderflowsSequencing` — token `0x06001051`.

Duyệt giá từ thấp lên cao:

- Nến giảm: tìm cụm Bid volume **giảm nghiêm ngặt** qua từng mức giá, độ dài đủ `ClusterSize`.
- Nến tăng: tìm cụm Ask volume **tăng nghiêm ngặt** qua từng mức giá, độ dài đủ `ClusterSize`.

Nhánh nến tăng ghi `OrderflowsSequencingBuy = Low` và zone Buy.

Nhánh nến giảm cũng ghi **`OrderflowsSequencingBuy = High`**, trong khi zone dùng `isAsk=true`. Không có lời gọi nào ghi `OrderflowsSequencingSell` trong detector này.

### 4.10 POC Slingshot

Method: `DetectPocSlingshot` — token `0x06001052`.

- Buy: bar hiện tại và bar trước đều tăng, nhưng `POC(t) < POC(t-1)`.
- Sell: cả hai bar đều giảm, nhưng `POC(t) > POC(t-1)`.
- Zone tại POC hiện tại; output tại Low/High hiện tại.

Đây là phân kỳ giữa hướng hai nến liên tiếp và hướng dịch chuyển POC.

### 4.11 Prominent POC Levels 1–3

Method: `DetectProminentPoc` — token `0x06001053`.

Detector duyệt Level 1 → 2 → 3 và dừng sau tín hiệu đầu tiên.

Sell của level `i`:

```text
nến giảm
High hiện tại >= max High của lookback_i bar trước
khoảng cách (High - POC) theo tick <= POCDistance_i - 1
và nếu checkDelta_i=true: Delta tại cell POC < 0
```

Buy:

```text
nến tăng
Low hiện tại <= min Low của lookback_i bar trước
khoảng cách (POC - Low) theo tick <= POCDistance_i - 1
và nếu checkDelta_i=true: Delta tại cell POC > 0
```

Mặc định:

| Level | Lookback | POC distance thực tế | Check cell Delta |
|---|---:|---:|---:|
| 1 | 0 | POC đúng tại High/Low | false |
| 2 | 0 | POC cách extreme tối đa 1 tick | false |
| 3 | 3 | POC cách extreme tối đa 2 ticks và bar tạo extreme so với ba bar trước | false |

Với lookback=0, helper `MyMax()` trả `double.MinValue` và `MyMin()` trả `double.MaxValue`, nên điều kiện extreme luôn cho qua.

### 4.12 Thin Prints

Method: `DetectThinPrints` — token `0x06001054`.

Bỏ qua cell đầu và cell cuối, chỉ duyệt các mức bên trong bar:

- Buy trên nến tăng nếu `Bid[cell] <= ThinPrintsMaximumVolume`.
- Sell trên nến giảm nếu `Ask[cell] <= ThinPrintsMaximumVolume`.
- Mỗi cell thỏa tạo một zone một mức.

Mặc định maximum volume là `1`. Nếu cùng bar có ít nhất `MultipleThinPrintsThreshold=3` zone đúng phía, renderer viền toàn bộ bar; không tạo public signal mới.

### 4.13 Orderflows Ratio — Price Defense / Price Exhaustion

Method: `DetectOrderflowsRatio` — token `0x06001055`.

Hai feature ID chính xác là `Orderflows Ratio Px Defense` và `Orderflows Ratio Px Exhaustion`.

Nến giảm:

```text
ratioSell = Ask[High-1 tick] / Ask[High]
nếu Ask[High] == 0 thì ratioSell = 0
```

Nến tăng:

```text
ratioBuy = Bid[Low+1 tick] / Bid[Low]
nếu Bid[Low] == 0 thì ratioBuy = 0
```

Phân loại:

- `ratio < RatioBoundsLow` → Price Defense.
- `ratio > RatioBoundsHigh` → Price Exhaustion.
- Sell zone đặt tại `High+1 tick`.
- Buy zone đặt tại `Low-1 tick`.

Mặc định `Low=0.69`, `High=30`. Raw ratio được lưu ở `OrderflowsRatioBuyValue` hoặc `OrderflowsRatioSellValue`.

Mặc định `OrderflowsRatioZoneSize=0`; `ZoneManager2` vì thế không thêm zone, nhưng signal series và raw ratio vẫn được ghi.

### 4.14 Zero Print

Method: `DetectZeroPrint` — token `0x06001056`.

- Nến tăng: nếu `Bid[Low]==0` hoặc `Bid[Low+1 tick]==0`, tạo zone Buy và ghi `ZeroPrintBuy=Low`.
- Nến giảm: nếu `Ask[High]==0` hoặc `Ask[High-1 tick]==0`, tạo zone Sell nhưng DLL lại ghi **`ZeroPrintBuy=High`**.

Không có đường code nào ghi `ZeroPrintSell` trong detector này.

### 4.15 Value Area

Method: `DetectValueArea` — token `0x06001057`.

Khi bật, detector luôn:

- Tạo zone `[ValueAreaLow, ValueAreaHigh]`.
- Gán phía zone theo nến: giảm→Sell, tăng→Buy, doji→neutral.
- Ghi fixed value `Value Area Low` và `Value Area High` cho mọi bar.

Đây là level/area output, không phải tín hiệu directional độc lập theo điều kiện.

### 4.16 Engulfing Value Area

Method: `DetectEngulfingValueArea` — token `0x06001058`.

Điều kiện:

```text
VAH(t) > VAH(t-1)
và VAL(t) < VAL(t-1)
```

- Nếu bar hiện tại tăng: Buy, zone toàn VA hiện tại.
- Nếu bar hiện tại giảm: Sell, zone toàn VA hiện tại.
- Doji không tạo tín hiệu.

### 4.17 Multiple Imbalances

Method: `DetectMultipleImbalances` — token `0x06001059`.

Duyệt toàn bộ mức giá và đếm tổng số Ask/Bid imbalance, không yêu cầu liên tiếp:

- Buy: nến tăng và tổng Ask imbalances `>= ExtremeImbalanceThreshold`.
- Sell: nến giảm và tổng Bid imbalances `>= ExtremeImbalanceThreshold`.
- Mặc định threshold là `3`.
- Zone Buy đặt tại High; zone Sell đặt tại Low; output vẫn ở Low/High theo hướng tín hiệu.

Code kiểm tra threshold ngay bên trong vòng lặp. Sau khi đạt ngưỡng, mỗi mức giá còn lại có thể gọi `AddZone()`/`SetValue()` lại; public series cuối cùng vẫn chỉ chứa một mức giá cho bar.

### 4.18 Inverse Imbalance và Stacked Imbalance

Method: `DetectImbalanceClustersWithInverse` — token `0x0600103D`.

Detector gom các Ask/Bid imbalance **liên tiếp**:

| Cụm | Hướng nến | Feature phát ra | Output |
|---|---|---|---|
| Ask imbalance | Up | Stacked Imbalance | Buy |
| Ask imbalance | Down | Inverse Imbalance | Sell |
| Bid imbalance | Down | Stacked Imbalance | Sell |
| Bid imbalance | Up | Inverse Imbalance | Buy |

- Stacked mặc định cần ba cell liên tiếp.
- Inverse mặc định cần hai cell liên tiếp.
- Zone bao từ cell đầu đến cell cuối của cụm.
- Nếu cả hai feature bật, mỗi feature áp swing filter riêng; một filter thất bại làm method return và có thể chặn cả feature còn lại.

Nhánh xử lý cụm Bid kéo dài tới cuối ladder thiếu điều kiện `barData.IsDownBar` cho Stacked Sell; do đó có thể ghi Stacked Sell trên nến tăng. Xem mục bất thường.

### 4.19 Open POC

Method: `DetectOpenPOC` — token `0x0600103F`.

- Sell: nến giảm và `POC(t) < MIN(Low, OpenPOCLookBackBars)` của cửa sổ trước.
- Buy: nến tăng và `POC(t) > MAX(High, OpenPOCLookBackBars)` của cửa sổ trước.
- Zone tại POC hiện tại.

Mặc định lookback là năm bar. Đây thực chất là POC nằm ngoài toàn bộ range của cửa sổ cũ theo hướng gap/breakout.

### 4.20 Aligned POC

Method: `DetectAlignedPOC` — token `0x06001040`.

- `POC(t) == POC(t-1)`.
- Nến hiện tại tăng → Buy.
- Nến hiện tại giảm → Sell.
- Không yêu cầu nến trước cùng hướng.
- Zone tại POC hiện tại.

### 4.21 Orderflows Gaps

Method: `DetectOrderflowsGaps` — token `0x06001041`.

Swing filter, nếu bật, kiểm tra offset=1.

Sell:

```text
nến hiện tại giảm
VAH(t) < VAL(t-1)
khoảng cách > 1 tick
zone = [VAH(t)+1 tick, VAL(t-1)-1 tick]
```

Buy:

```text
nến hiện tại tăng
VAL(t) > VAH(t-1)
khoảng cách > 1 tick
zone = [VAH(t-1)+1 tick, VAL(t)-1 tick]
```

### 4.22 Imbalance Reload

Method: `DetectImbalanceReload` — token `0x06001042`.

Chỉ xét vùng giá overlap của hai bar liên tiếp:

- Hai bar đều giảm và cùng có Bid imbalance tại đúng một mức giá → Sell tại mức đó.
- Hai bar đều tăng và cùng có Ask imbalance tại đúng một mức giá → Buy tại mức đó.
- Có thể tạo nhiều zone trên cùng bar nếu nhiều mức cùng thỏa.

### 4.23 Volume Decline

Method: `DetectVolumeDecline` — token `0x06001043`.

Cần ít nhất ba ladder cell và qua swing filter.

Sell trên nến giảm, xét ba mức từ High đi xuống:

```text
Ask[High] < Ask[High-1 tick] < Ask[High-2 ticks]
```

Buy trên nến tăng, xét ba mức từ Low đi lên:

```text
Bid[Low] < Bid[Low+1 tick] < Bid[Low+2 ticks]
```

Zone bao cả ba mức.

### 4.24 RetailSuck

Method: `DetectRetailSuck` — token `0x06001044`.

Là mẫu ngược Volume Decline:

Sell trên nến giảm:

```text
Ask[High] > Ask[High-1 tick] > Ask[High-2 ticks]
```

Buy trên nến tăng:

```text
Bid[Low] > Bid[Low+1 tick] > Bid[Low+2 ticks]
```

Zone bao cả ba mức.

### 4.25 POC Wave

Method: `DetectPOCWave` — token `0x06001045`.

Gọi ba bar:

```text
A = t-2
B = t-1
C = t
```

Gate:

- `barIndex >= 3`.
- Current bar có ít nhất ba ladder cell.
- Swing filter dùng `offset=1`, `allowEqual=true`, tức kiểm tra bar giữa B.

Sell:

```text
A Up, B Down, C Down
POC(B) > POC(A) > POC(C)
```

- Zone tại `High(B)`.
- Output `POCWaveSell = High(C)`.

Buy:

```text
A Down, B Up, C Up
POC(B) < POC(A) < POC(C)
```

- Zone tại `Low(B)`.
- Output `POCWaveBuy = Low(C)`.

Renderer viền cả ba bar A–C khi series hợp lệ.

### 4.26 Delta Tail

Method: `DetectDeltaTail` — token `0x06001046`.

Cần ít nhất ba ladder cell.

Buy:

```text
nến tăng
Delta cell tại Low < 0
mọi cell còn lại trong bar có Delta > 0
```

Sell:

```text
nến giảm
Delta cell tại High > 0
mọi cell còn lại trong bar có Delta < 0
```

Zone một mức tại Low/High.

### 4.27 Delta Breakout

Method: `DetectDeltaBreakout` — token `0x06001047`.

Nếu bật swing filter, current bar hoặc previous bar phải qua filter.

Buy:

```text
bar t và t-1 đều tăng
Delta(t) > 0 và Delta(t-1) > 0
Delta(t) - Delta(t-1) >= DeltaBreakoutThreshold
```

- Zone tại `Low(t)`.
- Output `DeltaBreakoutBuy = Low(t)`.

Sell:

```text
bar t và t-1 đều giảm
Delta(t) < 0 và Delta(t-1) < 0
Delta(t) - Delta(t-1) <= -DeltaBreakoutThreshold
```

- Zone tại `High(t)`.
- Output `DeltaBreakoutSell = High(t)`.

Mặc định threshold `200`. Đây là tăng tốc Delta giữa hai nến cùng hướng, không kiểm tra breakout giá. Renderer viền hai bar `t-1..t`.

### 4.28 Resting Liquidity

Method: `DetectRestingLiquidity` — token `0x06001048`.

Điều kiện chung:

- Có bar trước.
- Current và previous bar cùng hướng.

Buy:

- Cả hai bar tăng.
- Tại cùng một mức giá `p`: `Ask_t[p] >= threshold` và `Ask_(t-1)[p] >= threshold`.
- Nếu nhiều mức thỏa, chọn mức có Ask volume hiện tại lớn nhất.

Sell tương tự với hai bar giảm và Bid volume.

- Zone tại mức `p` đã chọn.
- Raw price dùng nội bộ renderer được lưu riêng ngoài signal series.
- Mặc định threshold `200`.

Nếu bật lookback, code kiểm tra previous bar: Buy yêu cầu High trước cao hơn cửa sổ cũ; Sell yêu cầu Low trước thấp hơn cửa sổ cũ. Bộ lọc này khác hướng với `DetectSwing()` chung.

### 4.29 Vertical Liquidity

Method: `DetectVerticalLiquidity` — token `0x06001049`.

Duyệt giá từ thấp lên cao và gom cell volume lớn liên tiếp:

- Buy trên nến tăng: cụm Ask volume `>= VerticalLiquidityThreshold`.
- Sell trên nến giảm: cụm Bid volume `>= VerticalLiquidityThreshold`.
- Cụm phải có ít nhất `VerticalLiquidityClusterSize` cell.
- Zone bao toàn bộ cụm.

Mặc định threshold `250`, cluster size `3`.

Swing filter riêng của detector dùng MAX/MIN tại cùng index với current bar. Khi filter được bật, biểu thức `MAX(...) >= High[current]` hoặc `MIN(...) <= Low[current]` luôn đúng theo semantics chuẩn của NinjaTrader MAX/MIN có chứa current value, nên detector return trước khi phát tín hiệu. Đây là lỗi logic có xác suất rất cao; cần replay để xác nhận hành vi runtime của exact NinjaTrader build.

## 5. Các output public quan trọng

Mỗi feature thường có hai public series `<Feature>Buy` và `<Feature>Sell`. Các property dùng được cho automation gồm:

```text
AccumulationDistributionBuy/Sell
ProminentPocLevel1Buy/Sell
ProminentPocLevel2Buy/Sell
ProminentPocLevel3Buy/Sell
TailsBuy/Sell
DeltaDivergenceBuy/Sell
PriceActionDivergenceBuy/Sell
ExhaustionPrintsBuy/Sell
ImbalanceReversalBuy/Sell
InverseVolumeImbalanceBuy/Sell
StackedImbalanceBuy/Sell
MarketSweepBuy/Sell
MarketWeaknessBuy/Sell
OrderflowsSequencingBuy/Sell
PocSlingshotBuy/Sell
ZeroPrintBuy/Sell
EngulfingValueAreaBuy/Sell
ThinPrintsBuy/Sell
OrderflowsRatioPxDefenseBuy/Sell
OrderflowsRatioPxExhaustionBuy/Sell
MultipleImbalancesBuy/Sell
OpenPOCBuy/Sell
AlignedPOCBuy/Sell
OrderflowsGapsBuy/Sell
ImbalanceReloadBuy/Sell
VolumeDeclineBuy/Sell
POCWaveBuy/Sell
DeltaTailBuy/Sell
DeltaBreakoutBuy/Sell
RetailSuckBuy/Sell
RestingLiquidityBuy/Sell
VerticalLiquidityBuy/Sell
```

Ngoài ra:

- `OrderflowsRatioBuyValue` và `OrderflowsRatioSellValue` chứa raw ratio.
- Value Area thực tế đăng ký plot/series với tên `Value Area Low` và `Value Area High`.
- Tín hiệu hợp lệ nên được kiểm tra bằng `IsValidDataPointAt(barIndex)`; giá trị series là price, không phải `1/-1`.

## 6. Hành vi bất thường và rủi ro khi auto-trading

### Mức cao

1. **Tails đảo nhãn**: nến giảm ở High ghi `TailsBuy`; nến tăng ở Low ghi `TailsSell`, trong khi hướng zone lại ngược với tên series.
2. **Orderflows Sequencing không ghi Sell**: cả nhánh nến tăng lẫn nến giảm đều gọi series `Buy`. `OrderflowsSequencingSell` không được set.
3. **Zero Print không ghi Sell**: nhánh nến giảm tạo zone Sell nhưng ghi `ZeroPrintBuy=High`. `ZeroPrintSell` không được set.
4. **Vertical Liquidity swing filter có vẻ chặn toàn bộ tín hiệu** khi `VerticalLiquidityUseLookBack=true` vì so MAX/MIN chứa chính current bar.
5. **Value Area getter mismatch**: feature đăng ký series `Value Area Low/High`, nhưng public getters `ValueAreaBuy/Sell` truy cập dictionary key `Value Area Buy/Sell`. Nếu gọi trực tiếp, có nguy cơ `KeyNotFoundException`.

### Mức trung bình

6. **Accumulation/Distribution Buy gần như luôn true trên nến tăng** khi passive filter tắt do điều kiện có `OR !PassiveTradersInControl`.
7. **Stacked Imbalance cuối ladder thiếu kiểm tra nến giảm** cho cụm Bid, có thể phát Stacked Sell trên nến tăng.
8. **Hai swing filter của Inverse/Stacked chặn lẫn nhau**: nếu cả hai feature bật và một filter fail, method return trước khi detector feature kia chạy.
9. **Orderflows Ratio mặc định ZoneSize=0**: series vẫn có tín hiệu, nhưng `AddZone()` bỏ qua hoàn toàn zone.
10. **Orderflows Ratio denominator bằng 0 được đổi thành ratio=0**, vì vậy rơi vào Price Defense khi lower bound dương; guard `ratio != -1` không có tác dụng.
11. **Multiple Imbalances gọi lặp sau khi đủ threshold**, có thể thêm nhiều zone trùng trong cùng bar.
12. **PocPriceBid update so với Bid volume tại general `PocPrice`**, không phải luôn so với current `PocPriceBid`; điều này có thể làm Accumulation/Distribution lệch khỏi ý nghĩa “Bid POC lớn nhất”.

### Mặc định bị ghi đè trong SetDefaults

`EnableDeltaDivergence` và các màu/opacity của nó được gán hai lần. Giá trị hiệu lực cuối cùng vẫn là enabled, draw `UntilTested`, opacity `50`, zone size `1`.

## 7. Visual-only logic không tạo signal series mới

- Multiple Thin Prints: viền bar nếu số Thin Print zone cùng phía `>= 3`.
- Multiple Imbalances: viền bar khi public MultipleImbalances series hợp lệ.
- POC Wave: viền ba bar của mẫu.
- Delta Breakout: viền hai bar của mẫu.
- Unfinished Business của base indicator, mặc định tắt:
  - Nến tăng có `Bid[High] > 0` tạo high unfinished-business line.
  - Nến giảm có `Ask[Low] > 0` tạo low unfinished-business line.
  - Line được finalize khi bar sau xuyên qua mức đó.
  - Đây là line renderer/base state, không thuộc 33 feature series của `OrderFlowsTrader`.

`DetectImbalanceClusters()` override trong `OrderFlowsTrader` là method rỗng; cluster signal thực tế được xử lý bởi `DetectImbalanceClustersWithInverse()` trong `DetectZones2()`.

## 8. Kết luận triển khai

Nếu dùng indicator làm nguồn tín hiệu cho strategy/EA:

1. Đọc public `Series<double>` và kiểm tra validity, không coi giá trị là boolean.
2. Nếu muốn tín hiệu không repaint, chỉ đọc bar đã đóng (`barsAgo=1`) hoặc tự khóa tín hiệu lúc bar close.
3. Không tin trực tiếp các series Tails, OrderflowsSequencingSell và ZeroPrintSell trước khi sửa/mapping lại các nhánh bất thường.
4. Tránh bật `VerticalLiquidityUseLookBack` nếu chưa replay xác nhận.
5. Với Value Area, ưu tiên plot index/tên `Value Area Low/High` thay vì getters `ValueAreaBuy/Sell`.
6. Lưu lại SHA-256 DLL; báo cáo này chỉ chính xác cho artifact đã nêu ở đầu file.

## 9. Bản đồ method token

| Method | Token |
|---|---|
| DetectZones2 | `0x0600103C` |
| DetectImbalanceClustersWithInverse | `0x0600103D` |
| DetectAccumulationDistribution | `0x0600103E` |
| DetectOpenPOC | `0x0600103F` |
| DetectAlignedPOC | `0x06001040` |
| DetectOrderflowsGaps | `0x06001041` |
| DetectImbalanceReload | `0x06001042` |
| DetectVolumeDecline | `0x06001043` |
| DetectRetailSuck | `0x06001044` |
| DetectPOCWave | `0x06001045` |
| DetectDeltaTail | `0x06001046` |
| DetectDeltaBreakout | `0x06001047` |
| DetectRestingLiquidity | `0x06001048` |
| DetectVerticalLiquidity | `0x06001049` |
| DetectBuyingSellingTails | `0x0600104A` |
| DetectDeltaDivergence | `0x0600104B` |
| DetectPriceActionDivergence | `0x0600104C` |
| DetectExhaustionPrints | `0x0600104D` |
| DetectImbalanceReversal | `0x0600104E` |
| DetectMarketSweep | `0x0600104F` |
| DetectMarketWeakness | `0x06001050` |
| DetectOrderflowsSequencing | `0x06001051` |
| DetectPocSlingshot | `0x06001052` |
| DetectProminentPoc | `0x06001053` |
| DetectThinPrints | `0x06001054` |
| DetectOrderflowsRatio | `0x06001055` |
| DetectZeroPrint | `0x06001056` |
| DetectValueArea | `0x06001057` |
| DetectEngulfingValueArea | `0x06001058` |
| DetectMultipleImbalances | `0x06001059` |
