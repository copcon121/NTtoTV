# Requirements Document

## Introduction

This document defines the requirements for a local, TradingView-like charting platform for the GC (Gold) futures contract. The platform sources live Level 1 market data from NinjaTrader/Rithmic, streams it through a Python FastAPI backend, persists it to SQLite, and renders interactive charts in a React web frontend using TradingView Lightweight Charts.

The MVP runs all-in-one on Windows and is read-only: it provides charting, precomputed timeframes, order-flow indicators (VolumeDelta, Footprint, BigTrade), and server-side alerts. It does not provide order entry, broker execution, or a DOM heatmap. Code is kept cross-platform so that a later phase can split the backend and web tiers onto Linux.

Priority order is: core chart first, then order-flow indicators (BigTrade, Footprint, VolumeDelta), then alerts.

## Glossary

- **NT_AddOn**: The NinjaTrader 8 C# AddOn that subscribes to GC Level 1 trade and quote data and forwards it to the Backend over a WebSocket client connection.
- **Backend**: The Python FastAPI service that ingests data from the NT_AddOn, computes derived data, persists it, exposes REST endpoints, and streams updates to the Frontend.
- **WebSocket_Registry**: The Backend component that tracks connected Frontend clients, manages heartbeats, and broadcasts events.
- **Bar_Aggregator**: The Backend component that aggregates raw ticks into OHLCV bars for each supported timeframe.
- **VolumeDelta_Engine**: The Backend component that computes per-bar volume delta metrics.
- **Footprint_Engine**: The Backend component that computes M1 bid-by-ask footprint ladders and associated metrics.
- **BigTrade_Engine**: The Backend component that reconstructs the tape and identifies large trades.
- **Alert_Engine**: The Backend component that evaluates alert conditions server-side and emits alert events.
- **Contract_Resolver**: The Backend component that selects the active GC contract from a configured candidate list based on per-candidate trade volume and quote activity.
- **Tick_Store**: The per-contract, day-sharded SQLite storage that records raw ticks and quotes for each subscribed GC contract.
- **Cache_Store**: The main SQLite database (`data/app.sqlite`) that stores metadata, bars, order-flow summaries, alerts, and alert events.
- **REST_API**: The HTTP interface exposed by the Backend for history, cache, contract, and alert operations.
- **Frontend**: The Vite + React + TypeScript web application that renders the chart and indicators.
- **Footprint_Canvas**: The custom HTML canvas layer in the Frontend that renders the footprint display.
- **Active_Contract**: The GC futures contract currently resolved as the front/active contract (for example, `GC 08-26`).
- **Sequence**: A monotonically increasing number attached to each market-data event within a Stream, used for ordering and duplicate detection. Sequence values increase monotonically within a single Stream.
- **Stream**: A distinct market-data channel identified by the tuple (symbol, contract, channel), where channel is either trade or quote. Sequence values increase monotonically within a single Stream and are independent across Streams.
- **Timeframe**: A bar aggregation interval. Supported values are 1m, 3m, 5m, 15m, 30m, 1h, 4h, and 1D.
- **Bounded_Queue**: The fixed-capacity in-memory queue inside the NT_AddOn that buffers normalized events between the NinjaTrader callback path and the background sender.
- **Candidate_Contract**: A GC futures contract in the configured candidate list that the NT_AddOn subscribes to and the Contract_Resolver evaluates when selecting the Active_Contract.
- **Control_Command**: A subscribe or unsubscribe instruction sent from the Backend to the NT_AddOn over the `ws://127.0.0.1:<port>/ws/nt` connection to change which GC contracts the NT_AddOn forwards.
- **Stream_Gap**: A detected discontinuity in a Stream's Sequence values where a received Sequence is greater than the highest processed Sequence plus one, indicating that one or more events are missing.
- **Canonical_Timestamp**: The canonical time representation used across the Backend and storage for merging and parity, defined as the integer number of milliseconds since the Unix epoch in UTC (equivalently ISO-8601 UTC with millisecond precision).
- **Stacked_Imbalance**: A footprint condition consisting of 2 or more consecutive price levels that are imbalanced on the same side (bid or ask), matching the 2-or-more consecutive same-side imbalanced level threshold used by the reference MzFootprintClone indicator.

## Requirements

### Requirement 1: Market Data Ingestion from NinjaTrader

**User Story:** As a trader, I want live GC trade and quote data captured from NinjaTrader/Rithmic, so that the chart reflects current market activity.

#### Acceptance Criteria

1. WHEN a GC Level 1 trade event is received from NinjaTrader, THE NT_AddOn SHALL normalize the event into a trade message containing type, symbol, contract, time, price, volume, bid, ask, bestBid, bestAsk, and sequence.
2. WHEN a GC Level 1 quote event is received from NinjaTrader, THE NT_AddOn SHALL normalize the event into a quote message containing type, symbol, contract, time, bid, ask, bidSize, askSize, and sequence.
3. WHEN the NT_AddOn normalizes a market-data event, THE NT_AddOn SHALL assign a monotonically increasing sequence value within the Stream, where a Stream is identified by the tuple (symbol, contract, channel) and channel is either trade or quote.
4. WHEN a normalized event is ready to send, THE NT_AddOn SHALL transmit the event to the Backend at `ws://127.0.0.1:<port>/ws/nt`.
5. WHEN the NT_AddOn starts, THE NT_AddOn SHALL subscribe to the Level 1 trade and quote feeds of every configured Candidate_Contract so that the Contract_Resolver receives per-candidate trade volume and quote activity for all candidates.
6. WHEN the NT_AddOn forwards a normalized event, THE NT_AddOn SHALL tag the event with the Candidate_Contract identifier from which the event originated.
7. WHEN the NT_AddOn receives a subscribe Control_Command from the Backend, THE NT_AddOn SHALL begin subscribing to the Level 1 trade and quote feeds of the specified GC contract.
8. WHEN the NT_AddOn receives an unsubscribe Control_Command from the Backend, THE NT_AddOn SHALL stop subscribing to the Level 1 trade and quote feeds of the specified GC contract.

### Requirement 2: NinjaTrader Thread Safety

**User Story:** As a trader, I want the data bridge to never block NinjaTrader, so that the NinjaTrader UI and market-data processing remain responsive.

#### Acceptance Criteria

1. WHEN a NinjaTrader market-data callback executes, THE NT_AddOn SHALL perform only event normalization and enqueue the result into the Bounded_Queue.
2. THE NT_AddOn SHALL perform JSON serialization, optional compression, and WebSocket transmission in a background worker that is separate from the NinjaTrader UI and Dispatcher threads.
3. THE NT_AddOn SHALL NOT perform network input/output, file input/output, or JSON serialization inside the NinjaTrader market-data callback path.
4. WHILE the Bounded_Queue is not critically overloaded, THE NT_AddOn SHALL retain every trade event.
5. WHEN a new quote event arrives and the Bounded_Queue is at capacity, THE NT_AddOn SHALL keep the latest quote and discard the superseded quote.
6. IF a trade event is dropped because the Bounded_Queue is critically overloaded, THEN THE NT_AddOn SHALL write a log entry recording the dropped trade.

### Requirement 3: NinjaTrader Reconnect Behavior

**User Story:** As a trader, I want the bridge to reconnect reliably after a disconnect, so that data flow resumes without manual intervention or resource exhaustion.

#### Acceptance Criteria

1. WHEN the connection from the NT_AddOn to the Backend is lost, THE NT_AddOn SHALL attempt reconnection using a Fibonacci backoff sequence of 1s, 1s, 2s, 3s, 5s, 8s, and continuing in Fibonacci order.
2. WHEN computing each reconnect delay, THE NT_AddOn SHALL add randomized jitter to the backoff value.
3. WHILE the computed backoff value exceeds 60 seconds, THE NT_AddOn SHALL cap the reconnect delay at 60 seconds.
4. WHEN the connection state of the NT_AddOn changes, THE NT_AddOn SHALL emit a status event reflecting the connected, degraded, or disconnected state.

### Requirement 4: Backend Data Stream Ingestion

**User Story:** As a trader, I want the backend to receive and validate the NinjaTrader stream, so that downstream computations operate on clean ordered data.

#### Acceptance Criteria

1. WHEN the NT_AddOn connects to `ws://127.0.0.1:<port>/ws/nt`, THE Backend SHALL accept the connection and begin receiving trade and quote messages.
2. WHEN a market-data event is received with a sequence value already processed for that stream, THE Backend SHALL discard the duplicate event.
3. WHEN a market-data event is received with a sequence value lower than the highest processed sequence for that stream, THE Backend SHALL discard the out-of-order event.
4. IF a market-data event is received with a sequence value greater than the highest processed sequence for that stream plus one, THEN THE Backend SHALL record a Stream_Gap in the log and in stream metadata, SHALL emit a degraded status event to subscribed Frontend clients, and SHALL treat the affected data as non-contiguous.
5. THE Backend SHALL record every received trade tick before applying user-interface update throttling.
6. WHERE auto-resolution determines that the set of GC contracts requiring data has changed, THE Backend SHALL send subscribe and unsubscribe Control_Commands to the NT_AddOn over the `ws://127.0.0.1:<port>/ws/nt` connection.
7. THE Backend SHALL apply a heartbeat and status-timeout to the `ws://127.0.0.1:<port>/ws/nt` connection that monitors received data, status, and heartbeat messages from the NT_AddOn.
8. IF no data message, status event, or heartbeat is received from the NT_AddOn on the `ws://127.0.0.1:<port>/ws/nt` connection within 15 seconds, THEN THE Backend SHALL treat the NT_AddOn connection as disconnected, SHALL emit a disconnected status event to subscribed Frontend clients, and SHALL release the connection resources for that connection.

### Requirement 5: Backend to Frontend Streaming and Throttling

**User Story:** As a trader, I want timely chart updates without overwhelming the browser, so that the chart stays current and responsive.

#### Acceptance Criteria

1. WHEN a Frontend client connects to `ws://127.0.0.1:<port>/ws/chart`, THE WebSocket_Registry SHALL register the client and stream subscribed events to that client.
2. THE Backend SHALL emit the following event types to subscribed Frontend clients: bar_update, quote_update, volume_delta_update, footprint_update, big_trade, alert_event, status, and ping.
3. WHEN streaming updates to Frontend clients, THE Backend SHALL throttle user-interface updates to an interval between 100 milliseconds and 125 milliseconds.
4. WHEN a Frontend client sends a subscribe request, THE Backend SHALL begin sending the requested event types for the requested symbol to that client.
5. WHEN a Frontend client sends an unsubscribe request, THE Backend SHALL stop sending the unsubscribed event types to that client.

### Requirement 6: WebSocket Heartbeat and Client Lifecycle

**User Story:** As a trader, I want stale browser connections detected and cleaned up, so that the backend does not leak resources or push to dead clients.

#### Acceptance Criteria

1. THE WebSocket_Registry SHALL send a ping event to each connected Frontend client every 30 seconds.
2. WHEN a Frontend client receives a ping event, THE Frontend SHALL respond with a pong message.
3. IF a Frontend client does not send a pong message within 60 seconds of a ping event, THEN THE WebSocket_Registry SHALL close the connection and remove the client.
4. IF an exception occurs while broadcasting to a Frontend client, THEN THE WebSocket_Registry SHALL catch the exception for that client and remove the dead connection while continuing to broadcast to remaining clients.

### Requirement 7: Raw Tick Storage

**User Story:** As a trader, I want raw ticks stored durably and partitioned by day, so that rebuilds, audits, and future replay are possible without bloating the main database.

#### Acceptance Criteria

1. WHEN the Backend persists raw market data, THE Tick_Store SHALL write trades and quotes to a per-contract, day-sharded SQLite file at `data/ticks/GC/<contract>/YYYY-MM-DD.sqlite`, where `<contract>` is the originating Candidate_Contract identifier.
2. THE Tick_Store SHALL maintain a ticks table and a quotes table within each day shard.
3. THE Cache_Store and Tick_Store SHALL operate in SQLite WAL mode.
4. THE Tick_Store SHALL retain raw tick shard files for 90 days.
5. WHEN a raw tick shard file is older than 90 days, THE Backend SHALL delete the expired shard file.

### Requirement 8: Bar and Order-Flow Caching

**User Story:** As a trader, I want precomputed bars and order-flow summaries stored separately from raw ticks, so that chart history loads quickly.

#### Acceptance Criteria

1. THE Cache_Store SHALL store metadata, bars, order-flow summaries, alerts, and alert events in the main database at `data/app.sqlite`.
2. THE Cache_Store SHALL key each bar and each order-flow summary record by symbol, contract, timeframe, and time.
3. WHEN serving chart history during normal use, THE Backend SHALL read precomputed bars from the Cache_Store rather than querying raw ticks.
4. THE Cache_Store SHALL retain precomputed bars indefinitely until a user deletes the data.
5. WHERE a rebuild or recompute job is requested, THE Backend SHALL read source data from the Tick_Store.

### Requirement 9: Timeframe Bar Aggregation

**User Story:** As a trader, I want bars precomputed for all standard timeframes, so that I can switch timeframes without recomputation delay.

#### Acceptance Criteria

1. THE Bar_Aggregator SHALL compute OHLCV bars for the timeframes 1m, 3m, 5m, 15m, 30m, 1h, 4h, and 1D.
2. WHEN a trade tick is recorded for the Active_Contract, THE Bar_Aggregator SHALL update the corresponding bar for each supported timeframe.
3. WHEN a bar is updated or closed, THE Backend SHALL emit a bar_update event to subscribed Frontend clients.
4. THE Bar_Aggregator SHALL bucket trade ticks into bars using UTC calendar boundaries derived from the Canonical_Timestamp, flooring intraday timeframes to multiples of their interval length and flooring the 1D timeframe to the UTC calendar day.
5. THE Bar_Aggregator SHALL determine the daily 1D bar boundary using the UTC calendar day in version 1, and SHALL NOT apply a configurable session or timezone template in version 1.

### Requirement 10: GC Contract Resolution

**User Story:** As a trader, I want the platform to track the correct front-month GC contract automatically, so that I always chart the active contract while retaining manual control.

#### Acceptance Criteria

1. THE Frontend SHALL present the user-facing symbol as GC.
2. WHEN auto-resolution is enabled, THE Contract_Resolver SHALL select the Active_Contract from the configured candidate list based on recent trade volume and quote activity.
3. THE Frontend SHALL display the resolved real contract identifier, for example `GC 08-26`.
4. WHERE a manual contract override is set in configuration or the user interface, THE Contract_Resolver SHALL use the overridden contract and disable auto-resolution.
5. THE Backend SHALL NOT construct a synthetic continuous GC contract in version 1.

### Requirement 11: Initial Chart Load

**User Story:** As a trader, I want the chart to load cached history and then stream live updates, so that I see complete context immediately and stay current.

#### Acceptance Criteria

1. WHEN a chart is first opened, THE Frontend SHALL fetch cached bars from the REST_API.
2. WHEN cached bars are loaded, THE Frontend SHALL subscribe to realtime updates through the chart WebSocket.
3. WHEN a realtime bar update is received, THE Frontend SHALL apply the update using an incremental series update rather than a full data replacement.
4. WHEN a history load misses the browser cache but hits the precomputed bar cache in the Cache_Store, THE Backend SHALL return the most recent 5,000 precomputed bars for the requested symbol, contract, and timeframe within 1.5 seconds.
5. WHERE a history load requires a rebuild from raw ticks in the Tick_Store, THE Backend SHALL perform the rebuild without a 1.5-second latency guarantee.

### Requirement 12: Timeframe Switching

**User Story:** As a trader, I want fast timeframe switching, so that I can analyze different intervals without waiting.

#### Acceptance Criteria

1. WHEN a user switches to a timeframe available in browser memory cache, THE Frontend SHALL render the cached bars immediately.
2. WHEN a user switches to a timeframe available in browser memory cache, THE Frontend SHALL complete the switch within 300 milliseconds.
3. WHEN a user switches to a timeframe with a missing data range, THE Frontend SHALL fetch the missing range in the background and patch the chart.
4. WHILE no symbol, timeframe, or visible-range change is in progress, THE Frontend SHALL avoid full chart repaints.

### Requirement 13: Volume Delta Indicator

**User Story:** As a trader, I want per-bar volume delta computed on the backend, so that I can read buy/sell pressure matching my existing NinjaTrader indicator.

#### Acceptance Criteria

1. THE VolumeDelta_Engine SHALL compute per bar the values volume, buyVolume, sellVolume, delta, deltaHigh, deltaLow, openDelta, and closeDelta.
2. WHEN a trade price is greater than or equal to the ask, THE VolumeDelta_Engine SHALL classify the trade volume as buy volume.
3. WHEN a trade price is less than or equal to the bid, THE VolumeDelta_Engine SHALL classify the trade volume as sell volume.
4. IF a trade cannot be classified by price relative to bid and ask, THEN THE VolumeDelta_Engine SHALL classify the trade using uptick or downtick direction.
5. IF a trade has no price change relative to the prior trade, THEN THE VolumeDelta_Engine SHALL reuse the last classified side.
6. THE VolumeDelta_Engine SHALL apply a default minimum trade size of 0 and operate in Delta mode by default.
7. WHERE the CumulativeDelta toggle is enabled, THE VolumeDelta_Engine SHALL accumulate delta across bars.
8. WHERE the replay event stream is identical, including bid/ask snapshot state and the Canonical_Timestamp precision, THE VolumeDelta_Engine output SHALL equal the output of the reference MyVolumeDelta indicator for all bars given the same configuration.

### Requirement 14: Footprint Indicator

**User Story:** As a trader, I want a live M1 footprint of the last few bars, so that I can read order flow at each price level.

#### Acceptance Criteria

1. THE Footprint_Engine SHALL compute footprint data at a fixed M1 timeframe.
2. THE Frontend SHALL display the last 3 live M1 footprint bars only.
3. THE Footprint_Engine SHALL produce a bid-by-ask ladder organized by price level for each footprint bar.
4. THE Footprint_Engine SHALL compute per footprint bar the metrics POC, bar delta, buy percentage, sell percentage, imbalance, Stacked_Imbalance, and unfinished auction.
5. THE Footprint_Engine SHALL apply the default configuration GroupTicksPerLevel = 0, DeltaCalculationMode = BidAsk, ImbalancePercent = 100, ImbalanceMinVolume = 10, and TradeVolumeFilter = 0.
6. WHEN footprint data, the price scale, or the layout changes, THE Footprint_Canvas SHALL redraw.
7. WHILE no footprint data, price scale, or layout change has occurred, THE Footprint_Canvas SHALL retain the current rendering.
8. WHEN the Footprint_Canvas redraws in response to streaming updates, THE Footprint_Canvas SHALL throttle redraws to an interval between 100 milliseconds and 125 milliseconds.
9. WHERE the replay event stream is identical, including bid/ask snapshot state and the Canonical_Timestamp precision, THE Footprint_Engine output rows, POC, and imbalance values SHALL equal the output of the reference MzFootprintClone indicator for all footprint bars given the same configuration.
10. THE Footprint_Engine SHALL identify a Stacked_Imbalance as 2 or more consecutive price levels that are imbalanced on the same side, matching the threshold of 2 or more consecutive same-side imbalanced levels used by the reference MzFootprintClone indicator.

### Requirement 15: Big Trade Indicator

**User Story:** As a trader, I want large trades highlighted on the chart, so that I can spot significant order flow.

#### Acceptance Criteria

1. THE BigTrade_Engine SHALL operate in simple mode without iceberg detection, DOM pressure, or DOM support.
2. WHEN multiple trades share the same Canonical_Timestamp and the same side, THE BigTrade_Engine SHALL merge them into a single reconstructed tape entry, using the Canonical_Timestamp as the merge key after serialization.
3. THE BigTrade_Engine SHALL apply the default configuration VolumeFilterEnable = true, MinVolume = 30, and MaxVolume = -1.
4. WHEN a reconstructed trade satisfies the volume filter, THE Backend SHALL emit a big_trade event for that trade.
5. WHEN a big_trade event is rendered, THE Frontend SHALL draw a bubble at the last trade price with a size proportional to the visible maximum volume and a label showing the trade volume.
6. WHERE the replay event stream is identical, including bid/ask snapshot state and the Canonical_Timestamp precision, THE BigTrade_Engine markers SHALL equal the markers produced by the reference BigTradeIndicator using MinVolume = 30 for all trades in that stream.

### Requirement 16: Alert Definition and Management

**User Story:** As a trader, I want to create and manage alerts, so that I am notified of market conditions I care about.

#### Acceptance Criteria

1. THE Alert_Engine SHALL support the alert types price crosses level, bar closes above level, bar closes below level, VolumeDelta threshold, BigTrade threshold, and stacked imbalance appears.
2. WHEN a user submits an alert creation request, THE REST_API SHALL persist the alert to the Cache_Store.
3. WHEN a user submits an alert deletion request, THE REST_API SHALL remove the identified alert from the Cache_Store.
4. WHEN a user enables or disables an alert, THE Alert_Engine SHALL include or exclude that alert from evaluation accordingly.
5. THE Frontend SHALL display alert lines on the chart and provide controls to enable, disable, and delete alerts.
6. THE Alert_Engine SHALL evaluate the price crosses level alert type against the last trade price of the Active_Contract.
7. THE Alert_Engine SHALL evaluate the bar closes above level and bar closes below level alert types against the close price of a closed bar.

### Requirement 17: Alert Evaluation and Notification

**User Story:** As a trader, I want alerts evaluated reliably on the backend and recorded, so that I receive notifications and can audit past triggers.

#### Acceptance Criteria

1. THE Alert_Engine SHALL evaluate all enabled alert conditions on the Backend.
2. WHEN an enabled alert condition is satisfied, THE Alert_Engine SHALL emit an alert_event to subscribed Frontend clients.
3. WHEN an alert condition is satisfied, THE Alert_Engine SHALL persist an alert event record to the Cache_Store.
4. WHEN an alert_event is received, THE Frontend SHALL display a toast notification, play a sound, and append the event to the event log.
5. WHEN a price crosses level alert condition is satisfied, THE Alert_Engine SHALL emit at most one alert_event for that crossing event.
6. WHEN a bar closes above level or bar closes below level alert condition is satisfied, THE Alert_Engine SHALL emit at most one alert_event for that bar-close event.
7. WHILE a price crosses level alert has fired and the last trade price has not returned to the opposite side of the level, THE Alert_Engine SHALL suppress further alert_event emissions for that alert and SHALL re-arm the alert only after the last trade price returns to the opposite side of the level.
8. WHILE a bar closes above level or bar closes below level alert has fired for a closed bar, THE Alert_Engine SHALL suppress further alert_event emissions for that alert until a subsequent bar closes, at which point THE Alert_Engine SHALL re-arm the alert for evaluation on the subsequent closed bar.

### Requirement 18: REST API Endpoints

**User Story:** As a developer integrating the Frontend, I want a defined REST interface, so that the Frontend can load metadata, history, order-flow data, and manage alerts.

#### Acceptance Criteria

1. WHEN a GET request is received at `/api/symbols`, THE REST_API SHALL return the available symbols.
2. WHEN a GET request is received at `/api/contracts?symbol=GC`, THE REST_API SHALL return the candidate GC contracts.
3. WHEN a POST request is received at `/api/contracts/active`, THE REST_API SHALL set the Active_Contract to the requested contract.
4. WHEN a GET request is received at `/api/history?symbol=GC&tf=<timeframe>&contract=<contract>&from=<from>&to=<to>&limit=<limit>`, THE REST_API SHALL return cached bars for the requested symbol, contract, timeframe, and range, and WHERE the contract query parameter is omitted THE REST_API SHALL default the contract to the current Active_Contract.
5. WHEN a GET request is received at `/api/orderflow/volume-delta?symbol=GC&tf=1m&contract=<contract>&from=<from>&to=<to>`, THE REST_API SHALL return volume delta data for the requested symbol, contract, and range, and WHERE the contract query parameter is omitted THE REST_API SHALL default the contract to the current Active_Contract.
6. WHEN a GET request is received at `/api/orderflow/footprint?symbol=GC&tf=1m&contract=<contract>&count=3`, THE REST_API SHALL return footprint data for the requested symbol, contract, and number of bars, and WHERE the contract query parameter is omitted THE REST_API SHALL default the contract to the current Active_Contract.
7. WHEN a GET request is received at `/api/big-trades?symbol=GC&contract=<contract>&from=<from>&to=<to>`, THE REST_API SHALL return big trade data for the requested symbol, contract, and range, and WHERE the contract query parameter is omitted THE REST_API SHALL default the contract to the current Active_Contract.
8. WHEN a GET request is received at `/api/alerts`, THE REST_API SHALL return the configured alerts.
9. WHEN a POST request is received at `/api/alerts`, THE REST_API SHALL create an alert from the request body.
10. WHEN a PATCH request is received at `/api/alerts/{id}`, THE REST_API SHALL update the enabled state and editable fields of the alert identified by id from the request body.
11. WHEN a DELETE request is received at `/api/alerts/{id}`, THE REST_API SHALL delete the alert identified by id.
12. IF a request references a symbol, contract, timeframe, or alert id that does not exist, THEN THE REST_API SHALL return a descriptive error response.

### Requirement 19: Frontend Chart Layout

**User Story:** As a trader, I want a TradingView-like layout, so that the platform feels familiar and information is easy to read.

#### Acceptance Criteria

1. THE Frontend SHALL display a chart area, a top toolbar, a timeframe selector, a symbol and contract label, a crosshair OHLCV box, a right price scale, a bottom time scale, and an alert panel.
2. THE Frontend SHALL render candles using the Lightweight Charts library and SHALL render the MVP indicator set Volume, VolumeDelta, BigTrade, and Footprint.
3. THE Frontend SHALL NOT render overlay indicators such as EMA, VWAP, or SMA in version 1 unless such an overlay is explicitly added to the indicator set.
4. THE Frontend SHALL render the footprint display on the Footprint_Canvas as a separate canvas layer from the Lightweight Charts series.
5. WHEN the crosshair moves over a bar, THE Frontend SHALL update the crosshair OHLCV box with the values of that bar.

### Requirement 20: Connection Status Visibility

**User Story:** As a trader, I want to see the live connection status, so that I know whether the data I am viewing is current.

#### Acceptance Criteria

1. WHEN the Backend receives a status event from the NT_AddOn, THE Backend SHALL forward a corresponding status event to subscribed Frontend clients.
2. WHEN the connection from the NT_AddOn to the Backend is lost, THE Backend SHALL emit a disconnected status event to subscribed Frontend clients.
3. WHEN a status event is received, THE Frontend SHALL display the connected, degraded, or disconnected state to the user.
