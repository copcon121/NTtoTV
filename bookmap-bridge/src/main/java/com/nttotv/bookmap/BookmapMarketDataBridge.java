package com.nttotv.bookmap;

import velox.api.layer1.annotations.Layer1ApiVersion;
import velox.api.layer1.annotations.Layer1ApiVersionValue;
import velox.api.layer1.annotations.Layer1SimpleAttachable;
import velox.api.layer1.annotations.Layer1StrategyName;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.simplified.Api;
import velox.api.layer1.simplified.CustomModuleAdapter;
import velox.api.layer1.simplified.DepthDataListener;
import velox.api.layer1.simplified.HistoricalModeListener;
import velox.api.layer1.simplified.InitialState;
import velox.api.layer1.simplified.TimeListener;
import velox.api.layer1.simplified.TradeDataListener;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicLong;

@Layer1SimpleAttachable
@Layer1StrategyName("NTtoTV Bookmap Market Data Live")
@Layer1ApiVersion(Layer1ApiVersionValue.VERSION2)
public class BookmapMarketDataBridge implements
    CustomModuleAdapter,
    TimeListener,
    TradeDataListener,
    DepthDataListener,
    HistoricalModeListener {

    private static final DateTimeFormatter DAY_FORMAT = DateTimeFormatter
        .ofPattern("yyyy-MM-dd")
        .withZone(ZoneOffset.UTC);

    private volatile boolean realtime;
    private String alias = "unknown";
    private InstrumentInfo instrumentInfo;
    private BookmapFootprintAccumulator accumulator;
    private BookmapLiquidityTracker liquidityTracker;
    private volatile BookmapLiquidityTracker.Config liquidityTrackerConfig;
    private ShadowWriter writer;
    private BookmapWebSocketSender sender;
    private Thread heartbeatThread;
    private double tickSize = 0.1;
    private double sizeMultiplier = 1.0;
    private final AtomicLong tradeSequence = new AtomicLong();
    private final AtomicLong heartbeatSequence = new AtomicLong();
    private final AtomicLong barSequence = new AtomicLong();
    private final AtomicLong liquiditySequence = new AtomicLong();
    private final Object outboundGate = new Object();
    private long acceptedTrades;
    private long skippedTradesWithoutInfo;
    private long exportedBars;
    private volatile long lastLiquiditySnapshotAt;

    @Override
    public void initialize(String alias, InstrumentInfo info, Api api, InitialState initialState) {
        this.alias = alias == null || alias.trim().isEmpty() ? "unknown" : alias;
        instrumentInfo = info;
        tickSize = info == null || info.pips <= 0.0 ? 0.1 : info.pips;
        sizeMultiplier = info == null || info.sizeMultiplier <= 0.0
            ? 1.0
            : info.sizeMultiplier;
        writer = new ShadowWriter(exportDirectory(), this.alias);
        accumulator = new BookmapFootprintAccumulator(
            tickSize,
            sizeMultiplier,
            new BookmapFootprintAccumulator.ClosedBarListener() {
                @Override
                public void onClosedBar(BookmapFootprintAccumulator.Bar bar) {
                    enqueueBar(bar, true, false);
                    exportBar(bar);
                }
            }
        );
        liquidityTrackerConfig = liquidityConfig();
        liquidityTracker = new BookmapLiquidityTracker(
            tickSize,
            sizeMultiplier,
            liquidityTrackerConfig,
            new BookmapLiquidityTracker.EventListener() {
                @Override
                public void onEvent(BookmapLiquidityTracker.Event event) {
                    enqueueLiquidity(event);
                }
            }
        );
        sender = new BookmapWebSocketSender(
            env("NTTOTV_BOOKMAP_WS_URL", "ws://127.0.0.1:8000/ws/bookmap"),
            new BookmapWebSocketSender.ConnectedListener() {
                @Override
                public void onConnected() {
                    enqueueSnapshots();
                }
            },
            new BookmapWebSocketSender.MessageListener() {
                @Override
                public void onMessage(String message) {
                    applyLiquidityConfig(message);
                }
            }
        );
        sender.start();
        startHeartbeat();
        realtime = envBool("NTTOTV_BOOKMAP_MARKET_INCLUDE_HISTORICAL", false);
        if (realtime) {
            long initialTime = initialState != null && initialState.getCurrentTime() > 0L
                ? initialState.getCurrentTime()
                : System.currentTimeMillis() * 1_000_000L;
            accumulator.onTimestamp(initialTime);
            liquidityTracker.startRealtime(initialTime);
        }
        log(
            "initialized alias=" + this.alias
                + " pips=" + tickSize
                + " sizeMultiplier=" + sizeMultiplier
                + " fullDepth=" + (info != null && info.isFullDepth)
                + " includeHistorical=" + realtime
        );
    }

    @Override
    public void onRealtimeStart() {
        synchronized (outboundGate) {
            BookmapFootprintAccumulator local = accumulator;
            if (local != null) {
                local.reset();
            }
            BookmapLiquidityTracker localLiquidity = liquidityTracker;
            if (localLiquidity != null) {
                localLiquidity.startRealtime(System.currentTimeMillis() * 1_000_000L);
            }
        }
        realtime = true;
        log("realtime capture started; first closed bar will be marked partialStart");
    }

    @Override
    public void onTimestamp(long timeNanos) {
        if (!realtime) {
            return;
        }
        BookmapFootprintAccumulator local = accumulator;
        if (local != null) {
            synchronized (outboundGate) {
                local.onTimestamp(timeNanos);
                BookmapLiquidityTracker localLiquidity = liquidityTracker;
                if (localLiquidity != null) {
                    localLiquidity.onTimestamp(timeNanos);
                }
            }
        }
    }

    @Override
    public void onDepth(boolean isBid, int price, int size) {
        BookmapLiquidityTracker local = liquidityTracker;
        if (local == null) {
            return;
        }
        synchronized (outboundGate) {
            BookmapFootprintAccumulator localAccumulator = accumulator;
            long timeNanos = localAccumulator == null
                ? 0L
                : localAccumulator.currentTimeNanos();
            local.onDepth(isBid, price, size, timeNanos);
        }
    }

    @Override
    public void onTrade(double price, int size, TradeInfo tradeInfo) {
        if (!realtime) {
            return;
        }
        if (tradeInfo == null) {
            skippedTradesWithoutInfo += 1L;
            return;
        }
        BookmapFootprintAccumulator local = accumulator;
        if (local == null) {
            return;
        }
        synchronized (outboundGate) {
            if (local.onTrade(
                price,
                size,
                tradeInfo.isBidAggressor,
                tradeInfo.isExecutionStart,
                tradeInfo.isExecutionEnd,
                tradeInfo.isOtc,
                tradeInfo.aggressorOrderId,
                tradeInfo.passiveOrderId
            )) {
                acceptedTrades += 1L;
                enqueueTrade(price, size, tradeInfo);
            }
        }
    }

    @Override
    public void stop() {
        realtime = false;
        BookmapLiquidityTracker localLiquidity = liquidityTracker;
        if (localLiquidity != null) {
            localLiquidity.stopRealtime();
        }
        Thread heartbeat = heartbeatThread;
        if (heartbeat != null) {
            heartbeat.interrupt();
        }
        BookmapWebSocketSender localSender = sender;
        if (localSender != null) {
            localSender.close();
        }
        BookmapFootprintAccumulator local = accumulator;
        boolean discardedOpenBar = local != null && local.hasOpenBar();
        long missingTimestamp = local == null ? 0L : local.skippedTradesWithoutTimestamp();
        int activeLiquidityLines = activeLiquidityLineCount();
        log(
            "stopped acceptedTrades=" + acceptedTrades
                + " exportedBars=" + exportedBars
                + " skippedWithoutTradeInfo=" + skippedTradesWithoutInfo
                + " skippedWithoutTimestamp=" + missingTimestamp
                + " activeLiquidityLines=" + activeLiquidityLines
                + " discardedOpenBar=" + discardedOpenBar
        );
    }

    private void startHeartbeat() {
        heartbeatThread = new Thread(new Runnable() {
            @Override
            public void run() {
                while (!Thread.currentThread().isInterrupted()) {
                    try {
                        Thread.sleep(1_000L);
                    } catch (InterruptedException ignored) {
                        return;
                    }
                    if (realtime) {
                        BookmapWebSocketSender local = sender;
                        if (local != null) {
                            local.enqueue(heartbeatJson(local), true);
                            long now = System.currentTimeMillis();
                            if (now - lastLiquiditySnapshotAt >= 30_000L) {
                                enqueueLiquiditySnapshots();
                                lastLiquiditySnapshotAt = now;
                            }
                        }
                    }
                }
            }
        }, "NTtoTV-Bookmap-Heartbeat");
        heartbeatThread.setDaemon(true);
        heartbeatThread.start();
    }

    private void enqueueTrade(double rawPrice, int rawSize, TradeInfo info) {
        BookmapWebSocketSender local = sender;
        BookmapFootprintAccumulator localAccumulator = accumulator;
        if (local == null || localAccumulator == null) {
            return;
        }
        long timeNanos = localAccumulator.currentTimeNanos();
        if (timeNanos <= 0L) {
            return;
        }
        long timeMs = Math.floorDiv(timeNanos, 1_000_000L);
        long bridgeTime = System.currentTimeMillis();
        long volume = Math.round(rawSize / sizeMultiplier);
        double price = round10(rawPrice * tickSize);
        StringBuilder sb = new StringBuilder(512);
        sb.append('{');
        stringField(sb, "type", "trade", true);
        stringField(sb, "source", "bookmap", true);
        stringField(sb, "symbol", env("NTTOTV_BOOKMAP_SYMBOL", "GC"), true);
        stringField(sb, "contract", env("NTTOTV_BOOKMAP_SOURCE_CONTRACT", "GC 12-26"), true);
        stringField(sb, "sourceContract", alias, true);
        stringField(sb, "alias", alias, true);
        numberField(sb, "time", Long.toString(timeMs), true);
        numberField(sb, "timeNanos", Long.toString(timeNanos), true);
        numberField(sb, "bridgeTime", Long.toString(bridgeTime), true);
        numberField(sb, "price", doubleString(price), true);
        numberField(sb, "volume", Long.toString(volume), true);
        stringField(sb, "side", info.isBidAggressor ? "buy" : "sell", true);
        booleanField(sb, "isBidAggressor", info.isBidAggressor, true);
        booleanField(sb, "executionStart", info.isExecutionStart, true);
        booleanField(sb, "executionEnd", info.isExecutionEnd, true);
        booleanField(sb, "otc", info.isOtc, true);
        stringField(sb, "aggressorOrderId", safe(info.aggressorOrderId), true);
        stringField(sb, "passiveOrderId", safe(info.passiveOrderId), true);
        numberField(sb, "sequence", Long.toString(tradeSequence.incrementAndGet()), false);
        sb.append('}');
        local.enqueue(sb.toString(), true);
    }

    private String heartbeatJson(BookmapWebSocketSender local) {
        BookmapFootprintAccumulator localAccumulator = accumulator;
        long timeNanos = localAccumulator == null ? 0L : localAccumulator.currentTimeNanos();
        long timeMs = timeNanos <= 0L
            ? System.currentTimeMillis()
            : Math.floorDiv(timeNanos, 1_000_000L);
        StringBuilder sb = new StringBuilder(320);
        sb.append('{');
        stringField(sb, "type", "heartbeat", true);
        stringField(sb, "source", "bookmap", true);
        stringField(sb, "symbol", env("NTTOTV_BOOKMAP_SYMBOL", "GC"), true);
        stringField(sb, "contract", env("NTTOTV_BOOKMAP_SOURCE_CONTRACT", "GC 12-26"), true);
        stringField(sb, "alias", alias, true);
        numberField(sb, "time", Long.toString(timeMs), true);
        numberField(sb, "timeNanos", Long.toString(timeNanos), true);
        numberField(sb, "bridgeTime", Long.toString(System.currentTimeMillis()), true);
        booleanField(
            sb,
            "hasCurrentBar",
            localAccumulator != null && localAccumulator.hasCurrentBar(),
            true
        );
        numberField(
            sb,
            "currentBarTime",
            Long.toString(localAccumulator == null ? 0L : localAccumulator.currentBarTime()),
            true
        );
        booleanField(
            sb,
            "partialStart",
            localAccumulator == null || localAccumulator.currentPartialStart(),
            true
        );
        numberField(sb, "queueDepth", Integer.toString(local.queueDepth()), true);
        numberField(sb, "droppedStale", Long.toString(local.droppedStale()), true);
        numberField(sb, "droppedOverflow", Long.toString(local.droppedOverflow()), true);
        numberField(
            sb,
            "activeLiquidityLines",
            Integer.toString(activeLiquidityLineCount()),
            true
        );
        numberField(sb, "sequence", Long.toString(heartbeatSequence.incrementAndGet()), false);
        sb.append('}');
        return sb.toString();
    }

    private void enqueueSnapshots() {
        synchronized (outboundGate) {
            BookmapFootprintAccumulator localAccumulator = accumulator;
            if (localAccumulator == null) {
                return;
            }
            BookmapFootprintAccumulator.Bar previous = localAccumulator.lastClosedSnapshot();
            BookmapFootprintAccumulator.Bar current = localAccumulator.currentSnapshot();
            if (previous != null) {
                enqueueBar(previous, true, true);
            }
            if (current != null) {
                enqueueBar(current, false, true);
            }
            BookmapLiquidityTracker localLiquidity = liquidityTracker;
            if (localLiquidity != null) {
                for (BookmapLiquidityTracker.Event event : localLiquidity.snapshots()) {
                    enqueueLiquidity(event);
                }
            }
            lastLiquiditySnapshotAt = System.currentTimeMillis();
        }
    }

    private void enqueueLiquiditySnapshots() {
        synchronized (outboundGate) {
            BookmapLiquidityTracker local = liquidityTracker;
            if (local == null) {
                return;
            }
            for (BookmapLiquidityTracker.Event event : local.snapshots()) {
                enqueueLiquidity(event);
            }
        }
    }

    private void enqueueLiquidity(BookmapLiquidityTracker.Event event) {
        BookmapWebSocketSender local = sender;
        if (local == null || event == null || event.timeNanos <= 0L) {
            return;
        }
        local.enqueue(
            liquidityJson(
                event,
                alias,
                env("NTTOTV_BOOKMAP_SYMBOL", "GC"),
                env("NTTOTV_BOOKMAP_SOURCE_CONTRACT", "GC 12-26"),
                System.currentTimeMillis(),
                liquiditySequence.incrementAndGet()
            ),
            !event.snapshot
        );
    }

    static String liquidityJson(
        BookmapLiquidityTracker.Event event,
        String alias,
        String symbol,
        String contract,
        long bridgeTime,
        long sequence
    ) {
        long timeMs = Math.floorDiv(event.timeNanos, 1_000_000L);
        StringBuilder sb = new StringBuilder(512);
        sb.append('{');
        stringField(sb, "type", "liquidity", true);
        stringField(sb, "source", "bookmap", true);
        stringField(sb, "symbol", symbol, true);
        stringField(sb, "contract", contract, true);
        stringField(sb, "sourceContract", alias, true);
        stringField(sb, "alias", alias, true);
        numberField(sb, "time", Long.toString(timeMs), true);
        numberField(sb, "timeNanos", Long.toString(event.timeNanos), true);
        numberField(sb, "bridgeTime", Long.toString(bridgeTime), true);
        stringField(sb, "eventKind", event.eventKind, true);
        stringField(sb, "action", event.action, true);
        stringField(sb, "side", event.side, true);
        numberField(sb, "price", doubleString(event.price), true);
        numberField(sb, "size", Integer.toString(event.size), true);
        numberField(sb, "previousSize", Integer.toString(event.previousSize), true);
        numberField(sb, "change", Integer.toString(event.change), true);
        numberField(sb, "threshold", Integer.toString(event.threshold), true);
        numberField(sb, "domDistance", Integer.toString(event.domDistance), true);
        numberField(sb, "strength", doubleString(event.strength), true);
        if (event.lineId == null) {
            sb.append("\"lineId\":null,");
            sb.append("\"lineStartTime\":null,");
        } else {
            stringField(sb, "lineId", event.lineId, true);
            numberField(
                sb,
                "lineStartTime",
                Long.toString(Math.floorDiv(event.lineStartTimeNanos, 1_000_000L)),
                true
            );
        }
        booleanField(sb, "snapshot", event.snapshot, true);
        numberField(sb, "sequence", Long.toString(sequence), false);
        sb.append('}');
        return sb.toString();
    }

    private static BookmapLiquidityTracker.Config liquidityConfig() {
        return new BookmapLiquidityTracker.Config(
            envBool("NTTOTV_LIQ_RELATIVE_ENABLED", true),
            envInt("NTTOTV_LIQ_RELATIVE_TRIGGER", 300),
            envInt("NTTOTV_LIQ_RELATIVE_DOM_FROM", 20),
            envInt("NTTOTV_LIQ_RELATIVE_DOM_TO", 80),
            envBool("NTTOTV_LIQ_ABSOLUTE_ENABLED", true),
            envInt("NTTOTV_LIQ_ABSOLUTE_TRIGGER", 500),
            envInt("NTTOTV_LIQ_ABSOLUTE_DOM_FROM", 1),
            envInt("NTTOTV_LIQ_ABSOLUTE_DOM_TO", 10),
            envBool("NTTOTV_LIQ_LONG_TERM_ENABLED", true),
            envInt("NTTOTV_LIQ_LONG_TERM_TRIGGER", 500),
            envInt("NTTOTV_LIQ_LONG_TERM_DOM_FROM", 1),
            envInt("NTTOTV_LIQ_LONG_TERM_DOM_TO", 80),
            envLong("NTTOTV_LIQ_LONG_TERM_MIN_AGE_MS", 30_000L) * 1_000_000L,
            envInt("NTTOTV_LIQ_LONG_TERM_UPDATE_SIZE", 50),
            envLong("NTTOTV_LIQ_LONG_TERM_UPDATE_INTERVAL_MS", 500L) * 1_000_000L
        );
    }

    private void applyLiquidityConfig(String json) {
        if (json == null || json.indexOf("\"liquidity_config\"") < 0) {
            return;
        }
        BookmapLiquidityTracker.Config current = liquidityTrackerConfig;
        if (current == null) {
            current = liquidityConfig();
        }
        BookmapLiquidityTracker.Config next = new BookmapLiquidityTracker.Config(
            jsonBoolean(json, "relativeEnabled", current.relativeEnabled),
            jsonInt(json, "relativeTrigger", current.relativeTrigger),
            jsonInt(json, "relativeDomFrom", current.relativeFrom),
            jsonInt(json, "relativeDomTo", current.relativeTo),
            jsonBoolean(json, "absoluteEnabled", current.absoluteEnabled),
            jsonInt(json, "absoluteTrigger", current.absoluteTrigger),
            jsonInt(json, "absoluteDomFrom", current.absoluteFrom),
            jsonInt(json, "absoluteDomTo", current.absoluteTo),
            jsonBoolean(json, "longTermEnabled", current.longTermEnabled),
            jsonInt(json, "longTermTrigger", current.longTermTrigger),
            jsonInt(json, "longTermDomFrom", current.longTermFrom),
            jsonInt(json, "longTermDomTo", current.longTermTo),
            (long)jsonInt(
                json,
                "longTermMinAgeMs",
                (int)(current.longTermMinAgeNanos / 1_000_000L)
            ) * 1_000_000L,
            jsonInt(json, "longTermUpdateSize", current.longTermUpdateSize),
            (long)jsonInt(
                json,
                "longTermUpdateIntervalMs",
                (int)(current.longTermUpdateIntervalNanos / 1_000_000L)
            ) * 1_000_000L
        );
        synchronized (outboundGate) {
            liquidityTrackerConfig = next;
            BookmapLiquidityTracker local = liquidityTracker;
            if (local != null) {
                BookmapFootprintAccumulator localAccumulator = accumulator;
                long timeNanos = localAccumulator == null
                    ? System.currentTimeMillis() * 1_000_000L
                    : localAccumulator.currentTimeNanos();
                local.updateConfig(next, timeNanos);
            }
        }
        log(
            "liquidity config applied relative=" + next.relativeEnabled
                + "/" + next.relativeTrigger
                + " absolute=" + next.absoluteEnabled
                + "/" + next.absoluteTrigger
                + " longTerm=" + next.longTermEnabled
                + "/" + next.longTermTrigger
        );
    }

    private static int jsonInt(String json, String field, int fallback) {
        int colon = jsonFieldColon(json, field);
        if (colon < 0) {
            return fallback;
        }
        int start = colon + 1;
        while (start < json.length() && Character.isWhitespace(json.charAt(start))) {
            start += 1;
        }
        int end = start;
        if (end < json.length() && json.charAt(end) == '-') {
            end += 1;
        }
        while (end < json.length() && Character.isDigit(json.charAt(end))) {
            end += 1;
        }
        if (end <= start) {
            return fallback;
        }
        try {
            return Integer.parseInt(json.substring(start, end));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static boolean jsonBoolean(String json, String field, boolean fallback) {
        int colon = jsonFieldColon(json, field);
        if (colon < 0) {
            return fallback;
        }
        int start = colon + 1;
        while (start < json.length() && Character.isWhitespace(json.charAt(start))) {
            start += 1;
        }
        if (json.startsWith("true", start)) {
            return true;
        }
        if (json.startsWith("false", start)) {
            return false;
        }
        return fallback;
    }

    private static int jsonFieldColon(String json, String field) {
        int key = json.indexOf("\"" + field + "\"");
        return key < 0 ? -1 : json.indexOf(':', key + field.length() + 2);
    }

    private int activeLiquidityLineCount() {
        synchronized (outboundGate) {
            BookmapLiquidityTracker local = liquidityTracker;
            return local == null ? 0 : local.activeLineCount();
        }
    }

    private void enqueueBar(
        BookmapFootprintAccumulator.Bar bar,
        boolean closed,
        boolean snapshot
    ) {
        BookmapWebSocketSender local = sender;
        if (local == null || bar == null) {
            return;
        }
        String json = barJson(
            bar,
            alias,
            env("NTTOTV_BOOKMAP_SYMBOL", "GC"),
            env("NTTOTV_BOOKMAP_SOURCE_CONTRACT", "GC 12-26"),
            closed,
            snapshot,
            System.currentTimeMillis(),
            barSequence.incrementAndGet()
        );
        // A full ladder snapshot repairs dropped tick frames and seeds a new
        // backend connection, so it must not expire with stale-sensitive ticks.
        local.enqueue(json, false);
    }

    static String barJson(
        BookmapFootprintAccumulator.Bar bar,
        String alias,
        String symbol,
        String contract,
        boolean closed,
        boolean snapshot,
        long bridgeTime,
        long sequence
    ) {
        StringBuilder sb = new StringBuilder(2048 + bar.rows.size() * 64);
        sb.append('{');
        stringField(sb, "type", "bar", true);
        stringField(sb, "source", "bookmap", true);
        stringField(sb, "symbol", symbol, true);
        stringField(sb, "contract", contract, true);
        stringField(sb, "sourceContract", alias, true);
        stringField(sb, "alias", alias, true);
        stringField(sb, "tf", "1m", true);
        numberField(sb, "time", Long.toString(bar.time), true);
        numberField(sb, "bridgeTime", Long.toString(bridgeTime), true);
        numberField(sb, "firstEventTimeNanos", Long.toString(bar.firstEventTimeNanos), true);
        numberField(sb, "lastEventTimeNanos", Long.toString(bar.lastEventTimeNanos), true);
        numberField(sb, "open", doubleString(bar.open), true);
        numberField(sb, "high", doubleString(bar.high), true);
        numberField(sb, "low", doubleString(bar.low), true);
        numberField(sb, "close", doubleString(bar.close), true);
        numberField(sb, "volume", Long.toString(bar.volume), true);
        numberField(sb, "buyVolume", Long.toString(bar.buyVolume), true);
        numberField(sb, "sellVolume", Long.toString(bar.sellVolume), true);
        numberField(sb, "delta", Long.toString(bar.delta), true);
        numberField(sb, "deltaHigh", Long.toString(bar.deltaHigh), true);
        numberField(sb, "deltaLow", Long.toString(bar.deltaLow), true);
        numberField(sb, "openDelta", "0", true);
        numberField(sb, "closeDelta", Long.toString(bar.delta), true);
        booleanField(sb, "closed", closed, true);
        booleanField(sb, "partialStart", bar.partialStart, true);
        booleanField(sb, "snapshot", snapshot, true);
        numberField(sb, "sequence", Long.toString(sequence), true);
        sb.append("\"rows\":[");
        for (int i = 0; i < bar.rows.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            BookmapFootprintAccumulator.Row row = bar.rows.get(i);
            sb.append('{');
            numberField(sb, "price", doubleString(row.price), true);
            numberField(sb, "bid", Long.toString(row.bid), true);
            numberField(sb, "ask", Long.toString(row.ask), false);
            sb.append('}');
        }
        sb.append(']');
        sb.append('}');
        return sb.toString();
    }

    private void exportBar(BookmapFootprintAccumulator.Bar bar) {
        ShadowWriter local = writer;
        if (local == null) {
            return;
        }
        try {
            local.append(bar.time, toJson(bar));
            exportedBars += 1L;
            if (exportedBars == 1L || exportedBars % 60L == 0L) {
                log(
                    "exported bar time=" + bar.time
                        + " volume=" + bar.volume
                        + " buy=" + bar.buyVolume
                        + " sell=" + bar.sellVolume
                        + " rows=" + bar.rows.size()
                        + " partialStart=" + bar.partialStart
                );
            }
        } catch (IOException e) {
            log("failed to export bar time=" + bar.time + ": " + e.getMessage());
        }
    }

    private String toJson(BookmapFootprintAccumulator.Bar bar) {
        String symbol = env("NTTOTV_BOOKMAP_SYMBOL", "GC");
        String contract = env("NTTOTV_BOOKMAP_CONTRACT", symbol);
        double tickSize = instrumentInfo == null || instrumentInfo.pips <= 0.0
            ? 0.1
            : instrumentInfo.pips;
        double sizeMultiplier = instrumentInfo == null || instrumentInfo.sizeMultiplier <= 0.0
            ? 1.0
            : instrumentInfo.sizeMultiplier;

        StringBuilder sb = new StringBuilder(2048 + bar.rows.size() * 64);
        sb.append('{');
        numberField(sb, "schemaVersion", "2", true);
        stringField(sb, "source", "bookmap", true);
        stringField(sb, "symbol", symbol, true);
        stringField(sb, "contract", contract, true);
        stringField(sb, "sourceContract", alias, true);
        stringField(sb, "alias", alias, true);
        stringField(sb, "tf", "1m", true);
        numberField(sb, "time", Long.toString(bar.time), true);
        numberField(sb, "firstEventTimeNanos", Long.toString(bar.firstEventTimeNanos), true);
        numberField(sb, "lastEventTimeNanos", Long.toString(bar.lastEventTimeNanos), true);
        numberField(sb, "tickSize", doubleString(tickSize), true);
        numberField(sb, "sizeMultiplier", doubleString(sizeMultiplier), true);
        numberField(sb, "open", doubleString(bar.open), true);
        numberField(sb, "high", doubleString(bar.high), true);
        numberField(sb, "low", doubleString(bar.low), true);
        numberField(sb, "close", doubleString(bar.close), true);
        numberField(sb, "volume", Long.toString(bar.volume), true);
        numberField(sb, "buyVolume", Long.toString(bar.buyVolume), true);
        numberField(sb, "sellVolume", Long.toString(bar.sellVolume), true);
        numberField(sb, "delta", Long.toString(bar.delta), true);
        numberField(sb, "deltaHigh", Long.toString(bar.deltaHigh), true);
        numberField(sb, "deltaLow", Long.toString(bar.deltaLow), true);
        numberField(sb, "openDelta", "0", true);
        numberField(sb, "closeDelta", Long.toString(bar.delta), true);
        numberField(sb, "tradeEvents", Long.toString(bar.tradeEvents), true);
        numberField(sb, "executionStarts", Long.toString(bar.executionStarts), true);
        numberField(sb, "executionEnds", Long.toString(bar.executionEnds), true);
        numberField(sb, "aggressorOrderIds", Integer.toString(bar.aggressorOrderIds), true);
        numberField(sb, "passiveOrderIds", Integer.toString(bar.passiveOrderIds), true);
        numberField(sb, "otcTrades", Long.toString(bar.otcTrades), true);
        booleanField(sb, "partialStart", bar.partialStart, true);
        sb.append("\"rows\":[");
        for (int i = 0; i < bar.rows.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            BookmapFootprintAccumulator.Row row = bar.rows.get(i);
            sb.append('{');
            numberField(sb, "price", doubleString(row.price), true);
            numberField(sb, "bid", Long.toString(row.bid), true);
            numberField(sb, "ask", Long.toString(row.ask), false);
            sb.append('}');
        }
        sb.append("]}");
        return sb.toString();
    }

    private static Path exportDirectory() {
        String configured = env("NTTOTV_BOOKMAP_MARKET_EXPORT_DIR", "");
        if (!configured.isEmpty()) {
            return Paths.get(configured);
        }
        return Paths.get(
            System.getProperty("user.home"),
            "Desktop",
            "NTtoTV",
            "_run_logs",
            "bookmap-market-data"
        );
    }

    private static void log(String message) {
        String line = Instant.now().toString() + " [NTtoTV Bookmap Market Data Live] " + message;
        System.out.println(line);
        try {
            Path directory = exportDirectory();
            Files.createDirectories(directory);
            Files.write(
                directory.resolve("bridge.log"),
                (line + System.lineSeparator()).getBytes(StandardCharsets.UTF_8),
                StandardOpenOption.CREATE,
                StandardOpenOption.APPEND
            );
        } catch (Throwable ignored) {
        }
    }

    private static String env(String name, String fallback) {
        String value = System.getProperty(name);
        if (value == null || value.trim().isEmpty()) {
            value = System.getenv(name);
        }
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private static boolean envBool(String name, boolean fallback) {
        String value = env(name, fallback ? "1" : "0");
        return "1".equals(value) || "true".equalsIgnoreCase(value) || "yes".equalsIgnoreCase(value);
    }

    private static int envInt(String name, int fallback) {
        try {
            return Integer.parseInt(env(name, Integer.toString(fallback)));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static long envLong(String name, long fallback) {
        try {
            return Long.parseLong(env(name, Long.toString(fallback)));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static void stringField(StringBuilder sb, String key, String value, boolean comma) {
        quote(sb, key);
        sb.append(':');
        quote(sb, value);
        if (comma) {
            sb.append(',');
        }
    }

    private static void numberField(StringBuilder sb, String key, String value, boolean comma) {
        quote(sb, key);
        sb.append(':').append(value);
        if (comma) {
            sb.append(',');
        }
    }

    private static void booleanField(StringBuilder sb, String key, boolean value, boolean comma) {
        quote(sb, key);
        sb.append(':').append(value ? "true" : "false");
        if (comma) {
            sb.append(',');
        }
    }

    private static void quote(StringBuilder sb, String value) {
        sb.append('"');
        if (value != null) {
            for (int i = 0; i < value.length(); i++) {
                char c = value.charAt(i);
                if (c == '"' || c == '\\') {
                    sb.append('\\').append(c);
                } else if (c == '\n') {
                    sb.append("\\n");
                } else if (c == '\r') {
                    sb.append("\\r");
                } else if (c == '\t') {
                    sb.append("\\t");
                } else {
                    sb.append(c);
                }
            }
        }
        sb.append('"');
    }

    private static String doubleString(double value) {
        if (!Double.isFinite(value)) {
            return "0";
        }
        return Double.toString(value);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static double round10(double value) {
        return Math.round(value * 10_000_000_000.0) / 10_000_000_000.0;
    }

    private static String sanitize(String value) {
        if (value == null || value.isEmpty()) {
            return "unknown";
        }
        StringBuilder sb = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (Character.isLetterOrDigit(c) || c == '-' || c == '_') {
                sb.append(c);
            } else {
                sb.append('_');
            }
        }
        return sb.toString();
    }

    private static final class ShadowWriter {
        private final Path directory;
        private final String filePrefix;

        ShadowWriter(Path directory, String alias) {
            this.directory = directory;
            filePrefix = sanitize(alias) + "-v2";
        }

        synchronized void append(long barTimeMs, String json) throws IOException {
            Files.createDirectories(directory);
            String day = DAY_FORMAT.format(Instant.ofEpochMilli(barTimeMs));
            Path path = directory.resolve(filePrefix + "-" + day + ".jsonl");
            Files.write(
                path,
                (json + System.lineSeparator()).getBytes(StandardCharsets.UTF_8),
                StandardOpenOption.CREATE,
                StandardOpenOption.APPEND
            );
        }
    }
}
