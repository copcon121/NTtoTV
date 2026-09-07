# Nghiên cứu: nâng Profit Factor cho mGann Break L/S bằng SMC, order flow và ML

**Đối tượng:** GC Chart Platform / auto L/S  
**Ngày:** 2026-09-05  
**Phạm vi:** đánh giá hướng cải thiện _tín hiệu vào lệnh_ mGann Break, không phải cam kết lợi nhuận hay khuyến nghị đầu tư cá nhân.

## Kết luận điều hành

Có thể cải thiện mGann Break L/S, nhưng hướng đáng làm là biến nó thành **base signal + point-in-time filter/ranker**, không phải thêm nhiều điều kiện cứng rồi tối ưu PF trên cùng một đoạn lịch sử. Thứ tự ưu tiên nên là:

1. Lập backtest tái hiện đúng cách vào/ra lệnh hiện tại và log PnL thực tế trước; hiện chưa thể nêu PF đáng tin cậy từ database.
2. Kiểm định lần lượt các context feature hiện có: SMC/liquidity, delta, footprint và session profile. Giữ feature chỉ khi nó cải thiện **out-of-sample** sau chi phí.
3. Dùng ML nhỏ, giải thích được, như một **meta-filter**: nó chỉ trả lời “có nên nhận base signal này không?”, không tự đoán Long/Short hay thay risk engine.
4. Chạy shadow/paper, rồi mới cấp quyền auto với giới hạn rủi ro và kill switch.

Lý do có cơ sở để thử order-flow filter: nghiên cứu thị trường vi mô cho thấy order-flow imbalance liên hệ với biến động giá ngắn hạn; quan hệ này cũng được tìm thấy trong một số hợp đồng futures. Điều đó **không chứng minh** rằng delta/footprint hiện tại tạo alpha trên GC, càng không chứng minh SMC/FVG/volume profile tạo alpha. Chúng là các giả thuyết feature cần kiểm định trên chính dữ liệu GC. [Cont, Kukanov & Stoikov](https://arxiv.org/abs/1011.6402), [Kang, Liu & Ni (commodity futures)](https://doi.org/10.1108/afr-10-2017-0099).

## Mức baseline đang có

### Rule auto mGann hiện tại

Theo `backend/app/engines/auto_mgann_trade.py` và `mgann_big_trade_sweep.py`, auto engine chỉ chạy khi M1 đóng và hiện yêu cầu:

- break BOS hoặc CHoCH qua swing M1 (`swing_size=5`);
- candle break cùng chiều, thân >= 50% range, wick ngược chiều không lớn hơn thân;
- volume >= 2 lần trung bình 20 bar trước;
- thân >= 2 lần trung bình 20 thân trước, loại bỏ thân > 8 lần trung bình;
- không yêu cầu BigTrade và mặc định không bật liquidity sweep filter;
- với thân > 4.0 GC, dùng limit tại 70% thân; các trường hợp khác vào market;
- SL ngoài high/low candle 2 ticks, TP 3R; sau +1R chuyển qua EMA21 trailing.

Đây là một breakout/momentum base signal tốt để làm “primary model”, nhưng **tại thời điểm quyết định auto nó chưa dùng** volume delta, footprint, FVG Grader, SMC order block/FVG zone, hay session volume profile. Các thứ này hiện phần lớn là dữ liệu/chart context, không phải entry gate.

### Dữ liệu sẵn có và giới hạn thực tế

Kiểm tra read-only `backend/data/app.sqlite` ngày 2026-09-05 cho logical contract `GC`:

| Dữ liệu | Phạm vi / số lượng | Ý nghĩa cho nghiên cứu |
|---|---:|---|
| M1 bars + volume delta | 859,244 rows; từ 2025-06-24 | Có thể replay base signal và các feature OHLCV/delta lịch sử. |
| Footprint M1 | 88,282 bars / 1,579,487 levels; từ 2026-06-05 | Chỉ giai đoạn này mới dùng được POC/VAH/VAL/imbalance ladder thật. |
| FVG Grader confirmed | 4,480 rows; từ 2026-06-23 | FVG phải được dùng theo **thời điểm confirmed**, không theo `source_time` đơn thuần. |
| Base candidates replay theo rule auto | 5,375 toàn lịch sử; 960 sau khi FVG đã có thể sẵn sàng | Tập full-feature hiện tại nhỏ cho ML; chưa phù hợp deep learning hay hyperparameter search rộng. |
| Auto-mGann order records | 119 records, 2026-08-12 đến 2026-09-03 | Mẫu live rất ngắn; không đủ kết luận PF hoặc train từ actual fills. |

Các `orders`/`order_events` hiện ghi entry, bracket, trạng thái và audit; payload close không giữ exit fill/realized PnL theo trade. Do đó con số “PF hiện tại” không thể được xác nhận một cách đúng đắn chỉ từ DB. Cần lấy MT5 deal/commission/swap/slippage và ghép với `order_id`/broker deal ticket, hoặc có simulator tái hiện đúng lifecycle.

Ngoài ra, delta từ trade/quote là một **ước lượng** hướng aggressive side. Hệ thống có rule ask/bid rồi uptick/downtick fallback, vì vậy chất lượng phụ thuộc feed và đồng bộ quote. Nghiên cứu Lee–Ready chỉ rõ quote có thể được ghi trước trade và trade trong spread khó phân loại. Cần lưu/đánh dấu data quality và không kết luận một feature delta tốt trên data source này sẽ giữ nguyên trên source khác. [Lee & Ready (1991)](https://www.acsu.buffalo.edu/~keechung/MGF743/Readings/Inferring%20trade%20direction%20from%20intraday%20data.pdf). CME cũng phân biệt top-of-book với depth/order-by-order; dữ liệu mới chỉ có Level 1 cho live NT path, dù footprint Bookmap/native có chất lượng tốt hơn khi sẵn có. [CME Top-of-Book FAQ](https://www.cmegroup.com/market-data/files/FAQ_BBO.pdf), [CME Futures and Options Data](https://www.cmegroup.com/market-data/browse-data/catalog/futures-and-options-data.html).

## Kiến trúc tín hiệu đề xuất

```text
M1 mGann candidate (giữ rule hiện tại)
          |
          v
point-in-time feature snapshot + data-quality gate
          |
          +--> deterministic filters được kiểm định từng cái
          |
          v
small ML meta-filter/ranker -> accept / abstain / size bucket
          |
          v
execution simulator hoặc broker -> existing SL/TP/EMA management
          |
          v
trade journal + delayed realized label + drift/risk controls
```

Không để model đổi direction, SL, TP hay tự học online trong runtime v1. Base signal đã xác định hướng và risk geometry; model chỉ có quyền **bỏ qua** setup chất lượng thấp (và về sau, phân nhóm risk size trong hard caps). Điều này làm bài toán nhỏ hơn, dễ audit hơn và đúng mục tiêu tăng PF: giảm gross loss từ setup xấu, thay vì tạo thêm lệnh.

## Feature cần thử, theo thứ tự ưu tiên

Tất cả giá trị bên dưới phải là snapshot tại hoặc trước thời điểm order có thể submit. Scale bằng tick/ATR/rolling percentile để không khóa vào một mức GC cố định.

| Nhóm | Feature point-in-time | Hypothesis / gate đầu tiên nên test |
|---|---|---|
| Base signal | `structure_kind`, break distance, body/range, body z-score 20 bar, volume z-score, signal time/session, direction | Phân tách BOS với CHoCH và điều kiện breakout thật sự mạnh. Đây là baseline bắt buộc. |
| SMC / liquidity | HTF bias (5m/15m), distance đến confirmed OB/FVG/PD zone, CHoCH có liquidity sweep, số pivot level bị quét | Long đồng pha HTF hoặc CHoCH sau sweep có thể tốt hơn break ngược dòng. Test **opposite-bias abstain** trước, không ép phải có mọi điều kiện. |
| Volume delta / CVD | signed delta z-score, close-delta sign, CVD slope/acceleration, price–delta divergence, delta/total-volume | Break cùng chiều với aggressive flow có thể đáng tin hơn. Test sign agreement và percentile; đừng chỉ test raw `delta > 0`. |
| Footprint | bar delta, buy/sell %, POC location trong candle, POC migration, VA width, diagonal/stacked imbalance count và direction, unfinished extreme, absorption proxy | Phân biệt initiative continuation với exhaustion/absorption. Tính stacked imbalance từ `footprint_levels`, không giả định nó có sẵn ở header. |
| Session / fixed-range profile | khoảng cách đến prior/developing POC/VAH/VAL, in-value/outside-value, VA acceptance/rejection, HVN/LVN distance, profile migration | Breakout từ value có thể khác breakout chạy thẳng vào HVN/POC. Profile phải chỉ dùng volume tích lũy **đến bar trước** (hoặc tách current bar rõ ràng). |
| FVG Grader | confirmed direction, level/pulse, breakout ratio, age, distance tới gap, same/opposite direction | Chỉ dùng FVG đã confirmed. Với schema hiện tại thiếu `available_at`, nên giai đoạn đầu dùng cutoff bảo thủ hoặc thêm cột availability rồi replay theo đó. Không dùng preview. |
| Execution/regime | spread/basis freshness, Bookmap/NT source, hour/session, day-of-week, volatility/range percentile, scheduled-news blackout nếu có source đáng tin | PF thường bị hỏng vì fills/regime; filter chỉ có ý nghĩa sau cost/slippage. Đây cũng là data-health kill gate. |

**Thứ tự kiểm định thực tế:** (1) `opposite HTF bias` + delta agreement, (2) footprint initiative/exhaustion, (3) session-profile location, (4) FVG confirmed. Nếu từng filter không cải thiện out-of-sample, không đưa nó vào model. Volume profile/SMC/FVG là feature hypothesis, không phải “truth” để yêu cầu đồng thuận toàn bộ; yêu cầu quá nhiều điều kiện thường làm sample quá nhỏ và tạo curve fit.

## ML: nên làm thế nào

### Có thể train, nhưng dùng meta-labeling thay vì black box direction model

Tạo một row cho **mỗi mGann candidate**, bao gồm cả lệnh bị reject. Label phải mô phỏng chính xác quyết định kinh tế:

- `net_r`: net R sau commission, spread, slippage, fill probability và toàn bộ logic limit/SL/TP/EMA; hoặc
- label nhị phân `positive_net_r`/`target_before_stop` khi simulator có path đáng tin.

Mục tiêu model là `E[net_R | features]` hoặc `P(net_R > 0 | features)`, rồi chỉ accept khi expected value/probability vượt threshold chọn trong validation. Đánh giá bằng net PF/expectancy/drawdown, **không** bằng classification accuracy.

Khởi đầu với logistic regression có regularization hoặc small gradient-boosted trees, giới hạn khoảng 10–20 feature đã chọn trước. Model phải có calibration chart và feature importance/SHAP. Với chỉ khoảng 960 candidate full-feature hiện tại, không dùng neural network, RL, AutoML hay grid search rộng. Nên ưu tiên tích lũy 6–12 tháng footprint/FVG có provenance ổn định; đây là khuyến nghị engineering để có nhiều regime hơn, không phải một ngưỡng thống kê thần kỳ.

### Simulator/labels là điều kiện tiên quyết

Backtest phải mô phỏng:

1. submit sau M1 close, market versus 70%-body limit;
2. fill/cancel limit tại +1R theo đúng rule live;
3. stop 2 ticks ngoài signal candle, TP 3R và EMA21 trailing từ +1R;
4. commission, broker spread, GC–XAU basis, slippage và rejection/stale basis;
5. thứ tự intrabar khi cùng M1 chạm cả SL và TP. Nếu không có tick path, report cả optimistic và conservative bound; không tự chọn thứ tự thuận lợi.

Module `backend/app/smc_ai/baseline.py` là điểm khởi đầu hữu ích vì đọc cache read-only và đã có label theo R, nhưng nó mô phỏng một chiến lược OB/FVG khác; không được gọi kết quả của nó là PF mGann. Cần một `mgann_backtest` riêng dùng cùng state/entry/exit code hoặc một pure shared policy module.

## Quy trình chống overfit bắt buộc

1. **Freeze base strategy và cost model.** Ghi trial ledger: mọi filter, feature, threshold, model, seed và đoạn data đã thử.
2. **Chronological walk-forward.** Train chỉ quá khứ, chọn threshold trong validation tiếp theo, test trên block thời gian chưa từng nhìn. Purge/embargo các sample có label horizon overlap với test để tránh leakage.
3. **Final untouched holdout.** Không được dùng để chọn feature, model hay threshold. Sau final holdout, paper/shadow forward mới là bằng chứng tiếp theo.
4. **Ablation.** So với mGann baseline: SMC-only, delta-only, footprint-only, profile-only, FVG-only, deterministic combination, ML combination. Công bố cả số trade bị loại.
5. **Robustness.** Báo cáo long/short, RTH/overnight, volatility quartile, tháng, data source, contract roll; bootstrap theo ngày hoặc block để tôn trọng clustering.
6. **Promotion gates.** Chỉ promote nếu net PF, expectancy, max drawdown, trade count và calibration đều tốt hơn baseline ở walk-forward **và** final holdout, không do vài trade lớn. Tính DSR/PBO và/hoặc White Reality Check trên toàn bộ family đã thử, không chỉ winner.

Đây không phải thủ tục hình thức. White mô tả data snooping là việc tái sử dụng data để chọn model và đưa ra test cho trường hợp “best model” sau specification search; Bailey et al. đề xuất đo xác suất backtest overfitting; DSR điều chỉnh selection bias và non-normality. [White (2000)](https://onlinelibrary.wiley.com/doi/pdf/10.1111%2F1468-0262.00152), [Probability of Backtest Overfitting](https://papers.ssrn.com/sol3/Papers.cfm?abstract_id=2326253), [Deflated Sharpe Ratio](https://papers.ssrn.com/sol3/Delivery.cfm/SSRN_ID2460551_code87814.pdf?abstractid=2460551).

## Kế hoạch triển khai đề xuất

### Phase 0 — measurement (làm trước, chưa đổi auto)

- Viết read-only mGann replay/backtester; snapshot every candidate và hai path intrabar bound khi cần.
- Import/record realized MT5 deal PnL, commission, swap, exit fill; liên kết với `auto_mgann_signal`/order id.
- Lưu `signal_id`, rule version, candidate time, feature availability time, raw feature snapshot, decision, score, threshold, data source/quality và eventual label. Không overwrite historical feature rows.
- Dashboard: candidate count, acceptance rate, realized/sim net-R, PF, expectancy, drawdown, long/short, missing-feature ratio, Bookmap/NT source.

**Exit criterion:** baseline PF có thể tái lập; chênh lệch giữa simulator và broker PnL được giải thích; không có look-ahead.

### Phase 1 — deterministic ablation (shadow)

- Pre-register 4–6 filter đơn giản trong bảng feature, mỗi filter chỉ 1–2 threshold.
- Run rolling walk-forward; winner phải qua final holdout.
- Shadow log `would_trade` so với `rejected_by_filter`, không gửi broker.

**Exit criterion:** ít nhất một filter cải thiện net PF/expectancy ổn định mà không làm trade count quá thấp hay chỉ tốt ở một session.

### Phase 2 — meta-filter (shadow trước)

- Train model nhỏ trên snapshot đã versioned; retrain theo lịch cố định, không online learning.
- Calibrate probability and choose accept threshold only from validation; freeze model artifact/version for each forward period.
- So sánh model với deterministic winner theo cùng candidate set/cost model.

**Exit criterion:** improvement còn tồn tại ở untouched holdout và forward shadow; calibration không drift mạnh.

### Phase 3 — guarded auto

- Bật bằng feature flag cho paper/demo hoặc lot tối thiểu; model chỉ `accept/abstain`.
- Hard guard độc lập model: max orders/day, max concurrent, daily loss/kill switch, consecutive-loss pause, source/data-quality stale pause, basis stale pause, session/news pause.
- Human audit và rollback ngay về base auto. CFTC nêu pre-trade controls, post-trade reporting, testing/supervision và system safeguards là những chủ đề trọng yếu trong môi trường automated trading. [CFTC](https://www.cftc.gov/PressRoom/PressReleases/6683-13).

## Quyết định đề xuất ngay bây giờ

**Nên chấp thuận:** xây Phase 0 + Phase 1; đây là con đường ngắn nhất để biết filter nào thật sự giúp PF.

**Chưa nên chấp thuận:** đưa ML trực tiếp vào auto, thêm nhiều gate theo cảm tính, hoặc tối ưu tham số trên toàn bộ 15 tháng bars. 74 ngày full order-flow/FVG hiện tại chỉ tạo 960 candidate hợp lệ; về mặt dữ liệu đó là research pilot, không phải bằng chứng đủ cho autonomous model phức tạp.

## Backtest mGann: latest rolling 90 days (2026-06-06 20:59 to 2026-09-04 20:59 UTC)

Đã chạy read-only replay trên cùng 88,861 M1 rows (bao gồm 500 warm-up bars). Replay giữ nguyên mGann auto L/S hiện tại: M1 BOS/CHoCH, volume/body >= 2x trung bình 20, loại body > 8x, market hoặc body-70%-limit, SL 2 ticks, TP 3R và EMA21 management. Không có raw ticks cho cả 3 tháng nên kết quả là **gross-R conservative approximation**, không phải verified broker PF:

- Market entry được tính tại signal-bar close; body > 4.0 dùng limit 70% body.
- Với intra-bar không biết thứ tự, long xét low/stop trước high/target và short xét high/stop trước low/target.
- Không cộng broker spread, commission, GC-XAU basis hay slippage; các khoản này có thể làm net PF thấp hơn.
- Delta case yêu cầu `direction * delta > 0` và `abs(delta) >= 2 * mean(abs(delta[-20:]))`; 20 bar là các bar đã đóng trước signal. Không dùng future data.

| Metric | Auto L/S hiện tại | Auto + delta cùng chiều, >= 2x prior-20 |
|---|---:|---:|
| Candidates | 1,151 | 1,151 |
| Submitted | 1,084 | 853 |
| Delta-rejected | 0 | 231 |
| Filled/closed | 995 | 778 |
| Limit cancelled at 1R | 89 | 75 |
| Win rate | 36.98% | 37.92% |
| Gross profit (R) | 604.69 | 479.20 |
| Gross loss (R) | 550.33 | 419.17 |
| Net R | 54.36 | 60.03 |
| Gross PF | **1.099** | **1.143** |
| Expectancy (R/trade) | 0.0546 | 0.0772 |

Delta filter giảm 21.3% số lệnh submit nhưng tăng PF khoảng 0.044 (+4.0% relative), tăng net R khoảng 10.4% và expectancy khoảng 41.2% trong cửa sổ này. Không có lệnh/lệnh limit còn mở ở cuối mẫu.

Phân rã theo chiều cho thấy phần lớn improvement đến từ **Long**: Long PF 1.197 -> 1.295 và net R 52.13 -> 59.57; Short PF 1.008 -> 1.002 và net R 2.23 -> 0.46. Vì vậy delta filter chung là một candidate tốt để tiếp tục kiểm định, nhưng chưa phải lý do để bật ML hoặc kết luận Short đã có edge. Cần tối thiểu thêm rolling windows/walk-forward và net execution cost trước promotion.

### Fixed-volume comparison: 1.0 lot

Kết quả R ở trên chuẩn hóa mỗi trade theo khoảng cách SL, tương đương risk-based sizing. Để phản ánh một fixed volume 1.0 lot, replay tính `side * (exit - entry) * 1.0`; do đó trade có SL/TP rộng đóng góp nhiều price-points hơn. PF không phụ thuộc việc chọn 1.0 hay 0.1 khi **tất cả** trade cùng lot, nhưng khác PF theo R vì weights của trade thay đổi.

| Metric (GC price-points x 1.0 lot, gross) | Auto L/S hiện tại | Auto + delta |
|---|---:|---:|
| Closed trades | 995 | 778 |
| Gross profit | 1,928.8 | 1,567.8 |
| Gross loss | 1,827.6 | 1,401.8 |
| Net | 101.2 | 166.0 |
| Fixed-lot PF | **1.055** | **1.118** |
| Expectancy / closed trade | 0.1017 | 0.2134 |

Theo fixed-lot, delta filter vẫn thắng rõ: net points +64.8 và PF +0.063, với 217 lệnh đóng ít hơn. Long là phần có edge (PF 1.205 -> 1.355; net +177.2 -> +231.0 points), còn Short âm ở cả hai case (PF 0.921 -> 0.914; net -76.0 -> -65.0 points). Các số points chưa quy đổi USD và vẫn chưa trừ execution cost thực tế của MT5.

### Fixed-volume comparison: add CHoCH BSL/SSL filter

Đã rerun cùng rolling 90-day window và fixed 1.0 lot. `Liquidity` là `filterLiquidity=true` trong shared mGann detector: CHoCH bullish cần SSL pool bị sweep, CHoCH bearish cần BSL pool bị sweep; defaults là >=2 pivots, lookback 120 bars, ATR margin 4.0 và sweep recent trong 5 bars. BOS không phải vượt gate này.

| Case | Candidates | Submitted | Closed | Net points x 1 lot | Fixed-lot PF | Expectancy/trade |
|---|---:|---:|---:|---:|---:|---:|
| Baseline | 1,151 | 1,084 | 995 | 101.2 | 1.055 | 0.1017 |
| Delta | 1,151 | 853 | 778 | 166.0 | 1.118 | 0.2134 |
| BSL/SSL liquidity | 623 | 584 | 532 | 36.7 | 1.036 | 0.0690 |
| Delta + BSL/SSL liquidity | 623 | 471 | 425 | 99.8 | **1.126** | **0.2348** |

Liquidity-only giảm PF và net points so với baseline, nên không có bằng chứng để bật nó độc lập. Kết hợp delta + liquidity đạt PF cao nhất nhưng chỉ cao hơn delta-only 0.007; đổi lại mất 353 closed trades và net points giảm 66.2. Long vẫn là contributor chính (PF 1.376 / net +141.8), còn Short vẫn âm (PF 0.899 / net -42.0). Vì vậy, current evidence ưu tiên **delta-only** nếu mục tiêu là net gain/sample; delta + liquidity chỉ đáng giữ làm candidate cho walk-forward nếu mục tiêu là selectivity/expectancy cao hơn.

### Replace EMA21 trailing with 1R break-even

Đã thêm backtest-only option `--breakeven-at-1r`: khi trade chạm +1R, SL được dời về entry; EMA21 trailing và EMA-cross exit bị tắt hoàn toàn. TP 3R, initial SL, body-limit/cancel rule và adverse-first M1 assumption không đổi. Không thay đổi auto live.

| Filter case | EMA21 trailing: Net / PF | 1R BE, no EMA: Net / PF | BE exits |
|---|---:|---:|---:|
| Baseline | 101.2 / 1.055 | 100.5 / **1.060** | 317 |
| Delta | **166.0** / 1.118 | 165.0 / **1.130** | 263 |
| BSL/SSL liquidity | 36.7 / 1.036 | 54.9 / **1.060** | 162 |
| Delta + BSL/SSL liquidity | 99.8 / 1.126 | 119.7 / **1.171** | 139 |

Trong fixed-lot 90-day replay, BE tăng PF ở cả bốn case. Delta + BSL/SSL + BE có PF và expectancy cao nhất: PF 1.171, net +119.7 points, expectancy +0.2816 points/trade; Long PF 1.467 / net +160.9. Tuy nhiên nó chỉ có 425 closed trades và Short vẫn âm (PF 0.884 / net -41.2). Delta + BE giữ net points gần cao nhất (+165.0) với 778 trades và PF 1.130.

Kết quả hiện nghiêng về `delta + 1R BE` nếu ưu tiên sample/net gain, hoặc `delta + liquidity + 1R BE` nếu chỉ ưu tiên PF/expectancy. Chưa chọn cho auto cho đến khi hai setup này qua nhiều rolling walk-forward windows sau khi trừ execution cost.

### Add M1 EMA200 trend gate to the 1R BE exit mode

Đã thêm backtest-only `--ema200-trend-filter`. EMA200 được cập nhật bằng signal M1 close trước khi xét signal trên chính close đó; Long yêu cầu `close > EMA200`, Short yêu cầu `close < EMA200`. Rerun dưới đây vẫn dùng 1R BE/no EMA21 trailing.

| Filter case | Without EMA200: Net / PF | With EMA200: Net / PF | EMA200-rejected | Closed with EMA200 |
|---|---:|---:|---:|---:|
| Baseline + BE | 100.5 / 1.060 | 24.3 / 1.018 | 222 | 789 |
| Delta + BE | 165.0 / 1.130 | 109.4 / 1.105 | 222 | 620 |
| BSL/SSL liquidity + BE | 54.9 / 1.060 | 56.4 / 1.070 | 75 | 458 |
| Delta + BSL/SSL liquidity + BE | 119.7 / 1.171 | **128.5 / 1.209** | 75 | 367 |

EMA200 is not a general improvement in this window: it harms baseline and delta-only. Nó chỉ làm stack đầy đủ `delta + BSL/SSL + 1R BE` tốt hơn: PF 1.171 -> 1.209, net +119.7 -> +128.5, expectancy +0.3501 points/trade, Long PF 1.529 / net +154.8. Short vẫn âm (PF 0.918 / net -26.3), và chỉ còn 367 closed trades. Vì đã thử nhiều gates trên cùng sample, kết quả đó là hypothesis cho walk-forward chứ chưa đủ để chọn auto rule.

### Fixed take-profit 1R, without EMA200

Added a backtest-only `--fixed-target-r 1` option. It places TP exactly 1R from entry and disables EMA21 trailing / EMA-cross exits. This rerun does not use the EMA200 gate or the 1R BE option, because TP is already closed at that same 1R threshold. All other assumptions remain unchanged, including the conservative adverse-first M1 path and fixed 1.0 lot gross points.

| Filter case | Closed | Targets / stops | Net points x 1 lot | Fixed-lot PF | Expectancy/trade |
|---|---:|---:|---:|---:|---:|
| Baseline | 995 | 499 / 496 | -47.3 | 0.972 | -0.0475 |
| Delta | 778 | 405 / 373 | **+80.7** | **1.064** | **+0.1037** |
| BSL/SSL liquidity | 532 | 259 / 273 | -66.1 | 0.928 | -0.1242 |
| Delta + BSL/SSL liquidity | 425 | 217 / 208 | +29.5 | 1.042 | +0.0694 |

Relative to the preceding 1R-BE/no-EMA21 mode, a hard 1R TP degrades every tested case: baseline PF 1.060 -> 0.972, delta 1.130 -> 1.064, liquidity 1.060 -> 0.928, and delta + liquidity 1.171 -> 1.042. Delta-only remains the only positive candidate, but materially weaker than delta + 1R BE (+80.7 / 1.064 versus +165.0 / 1.130). Thus the current 90-day sample does not support replacing 1R BE with a fixed 1R TP. No live Auto L/S behavior was changed.

### Current strategy, long-only, fixed 1R take profit (2026-09-06)

The current strategy code passes `volume_delta` into the shared mGann detector. The detector itself already requires direction-aligned delta and `abs(delta) >= 2x` the prior 20-bar average before it emits a signal. Consequently, in this version the extra backtest `--delta-filter` is redundant: both rows below are identical and `deltaRejected=0`. This supersedes comparisons in the earlier sections that treated the baseline as no-delta; the older results are not directly comparable to the current code.

This replay uses the same rolling 90-day window, fixed 1.0 lot, no EMA200, no BE/trailing EMA21, and a fixed 1R TP. `--trade-side long` skips short triggers before order submission; it does not alter the shared detector's state.

| Current filter case | All candidates / short skipped | Long submitted | Long closed | Targets / stops | Net points x 1 lot | Fixed-lot PF | Expectancy/trade |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baseline (already includes delta) | 1,368 / 685 | 645 | 599 | 313 / 286 | **+130.7** | **1.146** | **+0.2182** |
| Extra Delta flag (redundant) | 1,368 / 685 | 645 | 599 | 313 / 286 | +130.7 | 1.146 | +0.2182 |
| BSL/SSL liquidity | 709 / 356 | 334 | 308 | 159 / 149 | +50.0 | 1.106 | +0.1623 |
| Delta + BSL/SSL (same as liquidity) | 709 / 356 | 334 | 308 | 159 / 149 | +50.0 | 1.106 | +0.1623 |

For the code currently present, long-only baseline has the best net points, PF, and sample size. The finding remains provisional: historical delta provenance is not persisted per row, and M1 adverse-first exit simulation is not a tick-faithful execution replay. No live Auto L/S behavior was changed.

## Claim-to-source ledger

| Claim used | Source | Notes |
|---|---|---|
| Short-horizon price changes are tied more robustly to order-flow imbalance than raw trade volume in the authors' equity sample. | [Cont, Kukanov & Stoikov, *The Price Impact of Order Book Events*](https://arxiv.org/abs/1011.6402) | Rationale to test order-flow context; different asset class from GC. |
| Intraday commodity-futures evidence finds positive relation of order imbalance with returns/volatility. | [Kang, Liu & Ni, 2018](https://doi.org/10.1108/afr-10-2017-0099) | Commodity futures, but not GC; no direct performance claim. |
| Trade-side inference from quotes has timing/inside-spread limitations. | [Lee & Ready, 1991](https://www.acsu.buffalo.edu/~keechung/MGF743/Readings/Inferring%20trade%20direction%20from%20intraday%20data.pdf) | Supports data-quality/provenance guard. |
| Full-depth and top-of-book are different market-data products. | [CME market-data catalog](https://www.cmegroup.com/market-data/browse-data/catalog/futures-and-options-data.html) | Supports not conflating Level 1 with full book information. |
| Reusing data for model selection creates data-snooping risk; Reality Check addresses selection of the best specification. | [White, 2000](https://onlinelibrary.wiley.com/doi/pdf/10.1111%2F1468-0262.00152) | Supports trial ledger/multiple-testing controls. |
| PBO uses combinatorially symmetric cross-validation to estimate backtest-overfit probability. | [Bailey et al.](https://papers.ssrn.com/sol3/Papers.cfm?abstract_id=2326253) | Supports PBO/CV check. |
| DSR adjusts Sharpe evaluation for selection bias and non-normality. | [Bailey & López de Prado](https://papers.ssrn.com/sol3/Delivery.cfm/SSRN_ID2460551_code87814.pdf?abstractid=2460551) | Supporting diagnostic, not a replacement for holdout. |
| Automated trading requires pre-trade/post-trade/system safeguards as a risk-control theme. | [CFTC concept release](https://www.cftc.gov/PressRoom/PressReleases/6683-13) | Design guidance, not asserted as a specific requirement for this application. |

## Research stopping point and remaining gaps

The evidence is sufficient to recommend a constrained, validated filter/ranker design and reject direct complex ML deployment now. It is not sufficient to name a winning filter or report an improved PF: those require an execution-faithful GC replay, actual realized MT5 PnL, frozen timestamp-availability semantics for FVG/profile features, and forward validation. No claim in this report treats paper results or UI indicators as proof of live profitability.
