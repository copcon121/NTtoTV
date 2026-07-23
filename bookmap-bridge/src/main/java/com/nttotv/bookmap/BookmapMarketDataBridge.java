package com.nttotv.bookmap;

import velox.api.layer1.annotations.Layer1ApiVersion;
import velox.api.layer1.annotations.Layer1ApiVersionValue;
import velox.api.layer1.annotations.Layer1SimpleAttachable;
import velox.api.layer1.annotations.Layer1StrategyName;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.simplified.Api;
import velox.api.layer1.simplified.CustomModuleAdapter;
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

@Layer1SimpleAttachable
@Layer1StrategyName("NTtoTV Bookmap Market Data Shadow")
@Layer1ApiVersion(Layer1ApiVersionValue.VERSION2)
public class BookmapMarketDataBridge implements
    CustomModuleAdapter,
    TimeListener,
    TradeDataListener,
    HistoricalModeListener {

    private static final DateTimeFormatter DAY_FORMAT = DateTimeFormatter
        .ofPattern("yyyy-MM-dd")
        .withZone(ZoneOffset.UTC);

    private volatile boolean realtime;
    private String alias = "unknown";
    private InstrumentInfo instrumentInfo;
    private BookmapFootprintAccumulator accumulator;
    private ShadowWriter writer;
    private long acceptedTrades;
    private long skippedTradesWithoutInfo;
    private long exportedBars;

    @Override
    public void initialize(String alias, InstrumentInfo info, Api api, InitialState initialState) {
        this.alias = alias == null || alias.trim().isEmpty() ? "unknown" : alias;
        instrumentInfo = info;
        double tickSize = info == null || info.pips <= 0.0 ? 0.1 : info.pips;
        double sizeMultiplier = info == null || info.sizeMultiplier <= 0.0
            ? 1.0
            : info.sizeMultiplier;
        writer = new ShadowWriter(exportDirectory(), this.alias);
        accumulator = new BookmapFootprintAccumulator(
            tickSize,
            sizeMultiplier,
            new BookmapFootprintAccumulator.ClosedBarListener() {
                @Override
                public void onClosedBar(BookmapFootprintAccumulator.Bar bar) {
                    exportBar(bar);
                }
            }
        );
        realtime = envBool("NTTOTV_BOOKMAP_MARKET_INCLUDE_HISTORICAL", false);
        if (realtime && initialState != null && initialState.getCurrentTime() > 0L) {
            accumulator.onTimestamp(initialState.getCurrentTime());
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
        BookmapFootprintAccumulator local = accumulator;
        if (local != null) {
            local.reset();
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
            local.onTimestamp(timeNanos);
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
        }
    }

    @Override
    public void stop() {
        realtime = false;
        BookmapFootprintAccumulator local = accumulator;
        boolean discardedOpenBar = local != null && local.hasOpenBar();
        long missingTimestamp = local == null ? 0L : local.skippedTradesWithoutTimestamp();
        log(
            "stopped acceptedTrades=" + acceptedTrades
                + " exportedBars=" + exportedBars
                + " skippedWithoutTradeInfo=" + skippedTradesWithoutInfo
                + " skippedWithoutTimestamp=" + missingTimestamp
                + " discardedOpenBar=" + discardedOpenBar
        );
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
        stringField(sb, "source", "bookmap_shadow", true);
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
        String line = Instant.now().toString() + " [NTtoTV Bookmap Market Data Shadow] " + message;
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
