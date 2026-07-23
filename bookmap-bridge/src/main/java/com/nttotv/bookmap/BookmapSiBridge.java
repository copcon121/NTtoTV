package com.nttotv.bookmap;

import com.bookmap.addons.broadcasting.api.view.BroadcasterConsumer;
import com.bookmap.addons.broadcasting.api.view.EventFilter;
import com.bookmap.addons.broadcasting.api.view.GeneratorInfo;
import com.bookmap.addons.broadcasting.api.view.listeners.ConnectionStatusListener;
import com.bookmap.addons.broadcasting.api.view.listeners.LiveConnectionStatusListener;
import com.bookmap.addons.broadcasting.api.view.listeners.LiveEventListener;
import com.bookmap.addons.broadcasting.api.view.listeners.ProviderStatusListener;
import com.bookmap.addons.broadcasting.api.view.listeners.UpdateFilterListener;
import com.bookmap.addons.broadcasting.api.view.listeners.UpdateSettingsListener;
import com.bookmap.addons.broadcasting.implementations.base.CastUtilities;
import com.bookmap.addons.broadcasting.implementations.base.FailedToCastObject;
import com.bookmap.addons.broadcasting.implementations.view.BroadcastFactory;
import velox.api.layer1.Layer1ApiAdminAdapter;
import velox.api.layer1.annotations.Layer1ApiVersion;
import velox.api.layer1.annotations.Layer1ApiVersionValue;
import velox.api.layer1.annotations.Layer1SimpleAttachable;
import velox.api.layer1.annotations.Layer1StrategyName;
import velox.api.layer1.common.ListenableHelper;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.messages.Layer1ApiSoundAlertMessage;
import velox.api.layer1.simplified.Api;
import velox.api.layer1.simplified.CustomModuleAdapter;
import velox.api.layer1.simplified.InitialState;
import velox.indicators.sionchart.broadcasting.EventInterface;
import velox.indicators.sionchart.broadcasting.SitSettings;
import velox.indicators.sionchart.broadcasting.implementations.IcebergEvent;
import velox.indicators.sionchart.broadcasting.implementations.StopEvent;
import velox.indicators.sionchart.broadcasting.implementations.ThresholdFilter;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class BookmapSiBridge implements CustomModuleAdapter, Layer1ApiAdminAdapter {
    private static final String ADDON_NAME = "NTtoTV Bookmap SI Bridge";
    private static final String SI_PROVIDER = "velox.indicators.sionchart.SitIndicator";
    private static final long NANOS_PER_MILLI = 1_000_000L;
    private static final long EPOCH_MICROS_THRESHOLD = 100_000_000_000_000L;
    private static final long EPOCH_NANOS_THRESHOLD = 100_000_000_000_000_000L;
    private static final Pattern SOUND_ALERT_PATTERN = Pattern.compile(
        "\\b(Iceberg|Stop|Stops)\\b\\s+(\\S+)\\s+(buy|sell)\\s+at\\s+"
            + "([0-9]+(?:\\.[0-9]+)?)\\s+(?:crossed|volume)\\s+([0-9]+(?:\\.[0-9]+)?)",
        Pattern.CASE_INSENSITIVE
    );

    private final ExecutorService httpExecutor = Executors.newSingleThreadExecutor(new ThreadFactory() {
        @Override
        public Thread newThread(Runnable runnable) {
            Thread thread = new Thread(runnable, "nttotv-bookmap-si-http");
            thread.setDaemon(true);
            return thread;
        }
    });
    private final AtomicLong lastHttpErrorLogMs = new AtomicLong(0L);

    private String alias;
    private InstrumentInfo instrumentInfo;
    private Api api;
    private BroadcasterConsumer consumer;
    private volatile boolean connected;
    private volatile boolean subscribed;
    private volatile String generatorName;
    private volatile EventFilter<EventInterface> eventFilter;
    private volatile boolean adminListenerRegistered;
    private volatile boolean legacySubscribed;
    private volatile LegacySiBroadcast legacyBroadcast;
    private final AtomicLong lastLegacyEventMs = new AtomicLong(0L);

    @Override
    public void initialize(String alias, InstrumentInfo info, Api api, InitialState initialState) {
        this.alias = alias;
        this.instrumentInfo = info;
        this.api = api;
        log("initialize alias=" + alias + " pips=" + info.pips + " sizeMultiplier=" + info.sizeMultiplier);

        try {
            ListenableHelper.addListeners(api.getProvider(), this);
            adminListenerRegistered = true;
            log("admin listener registered");
        } catch (Throwable t) {
            log("failed to register admin listener: " + t);
        }

        subscribeLegacy();

        if (isBrapiEnabled()) {
            try {
                consumer = BroadcastFactory.getBroadcasterConsumer(api.getProvider(), ADDON_NAME, BookmapSiBridge.class);
                consumer.setProviderStatusListener(new ProviderStatusListener() {
                    @Override
                    public void providerBecameAvailable(String providerName, String providerClassName) {
                        log("provider available: " + providerName + " / " + providerClassName);
                        if (SI_PROVIDER.equals(providerClassName) || SI_PROVIDER.equals(providerName)) {
                            connect();
                        }
                    }

                    @Override
                    public void providerUpdateGenerator(
                        String providerName,
                        String providerClassName,
                        GeneratorInfo generatorInfo,
                        boolean isAdded
                    ) {
                        if (SI_PROVIDER.equals(providerClassName) || SI_PROVIDER.equals(providerName)) {
                            log("provider generator " + (isAdded ? "added" : "removed") + ": "
                                + generatorInfo.getGeneratorName());
                            if (isAdded && !subscribed && alias.equals(generatorInfo.getGeneratorName())) {
                                subscribe(generatorInfo);
                            }
                        }
                    }
                });
                consumer.start();
                log("available providers after start: " + consumer.getAvailableProviders());
                connect();
            } catch (Throwable t) {
                log("failed to initialize BrAPI consumer: " + t);
            }
        } else {
            log("BrAPI consumer disabled; using legacy SI broadcast");
        }
    }

    @Override
    public void stop() {
        try {
            unsubscribeLegacy();
            if (consumer != null) {
                if (generatorName != null) {
                    try {
                        consumer.unsubscribeFromLiveData(SI_PROVIDER, generatorName);
                    } catch (Throwable t) {
                        log("unsubscribe failed: " + t);
                    }
                }
                try {
                    consumer.disconnectFromProvider(SI_PROVIDER);
                } catch (Throwable t) {
                    log("disconnect failed: " + t);
                }
                consumer.finish();
            }
        } finally {
            if (adminListenerRegistered && api != null) {
                try {
                    ListenableHelper.removeListeners(api.getProvider(), this);
                } catch (Throwable t) {
                    log("failed to remove admin listener: " + t);
                }
            }
            adminListenerRegistered = false;
            subscribed = false;
            connected = false;
            httpExecutor.shutdownNow();
            log("stopped");
        }
    }

    @Override
    public void onUserMessage(Object message) {
        if (!(message instanceof Layer1ApiSoundAlertMessage)) {
            return;
        }
        onSoundAlert((Layer1ApiSoundAlertMessage) message);
    }

    private void connect() {
        if (consumer == null || connected) {
            return;
        }
        try {
            consumer.connectToProvider(SI_PROVIDER, new ConnectionStatusListener() {
                @Override
                public void reactToStatusChanges(boolean status) {
                    connected = status;
                    log("SI provider connection=" + status);
                    if (status) {
                        subscribeToAlias();
                    }
                }
            });
        } catch (Throwable t) {
            log("connectToProvider failed: " + t);
        }
    }

    private void subscribeToAlias() {
        if (consumer == null || subscribed) {
            return;
        }
        try {
            List<GeneratorInfo> generators = consumer.getGeneratorsInfo(SI_PROVIDER);
            log("SI generators: " + generators);
            for (GeneratorInfo generator : generators) {
                if (alias.equals(generator.getGeneratorName())) {
                    subscribe(generator);
                    return;
                }
            }
            log("no SI generator matched alias=" + alias + "; keep the SI On-Chart add-on attached to this instrument");
        } catch (Throwable t) {
            log("subscribeToAlias failed: " + t);
        }
    }

    @SuppressWarnings("unchecked")
    private void subscribe(GeneratorInfo generator) {
        if (consumer == null || subscribed) {
            return;
        }
        generatorName = generator.getGeneratorName();
        try {
            consumer.setListenersForGenerator(
                SI_PROVIDER,
                generatorName,
                new UpdateFilterListener() {
                    @Override
                    public void reactToFilterUpdates(Object rawFilter) {
                        if (rawFilter == null) {
                            eventFilter = null;
                            return;
                        }
                        try {
                            eventFilter = (EventFilter<EventInterface>) CastUtilities.castObject(
                                rawFilter,
                                ThresholdFilter.class
                            );
                            log("SI filter updated");
                        } catch (FailedToCastObject e) {
                            log("failed to cast SI filter: " + e);
                        }
                    }
                },
                new UpdateSettingsListener() {
                    @Override
                    public void reactToSettingsUpdate(Object rawSettings) {
                        if (rawSettings == null) {
                            return;
                        }
                        try {
                            SitSettings settings = CastUtilities.castObject(rawSettings, SitSettings.class);
                            log("SI settings updated enableBroadcasting=" + settings.isEnableBroadcasting());
                        } catch (FailedToCastObject e) {
                            log("failed to cast SI settings: " + e);
                        }
                    }
                }
            );
            consumer.subscribeToLiveData(
                SI_PROVIDER,
                generatorName,
                new LiveEventListener() {
                    @Override
                    public void giveEvent(Object event) {
                        onLiveEvent(event);
                    }
                },
                new LiveConnectionStatusListener() {
                    @Override
                    public void reactToStatusChanges(boolean status) {
                        subscribed = status;
                        log("SI live subscription " + generatorName + "=" + status);
                    }
                }
            );
        } catch (Throwable t) {
            log("subscribe failed for generator=" + generatorName + ": " + t);
        }
    }

    private void onLiveEvent(Object rawEvent) {
        if (rawEvent == null) {
            return;
        }
        try {
            EventInterface event = castSiEvent(rawEvent);
            if (event == null) {
                log("ignored unsupported SI event class=" + rawEvent.getClass().getName());
                return;
            }
            EventFilter<EventInterface> filter = eventFilter;
            if (filter != null) {
                event = filter.toFilter(event);
                if (event == null) {
                    return;
                }
            }
            String json = toJson(event, eventKind(rawEvent));
            postAsync(json);
        } catch (Throwable t) {
            log("live event handling failed: " + t);
        }
    }

    private void subscribeLegacy() {
        if (api == null || legacySubscribed) {
            return;
        }
        try {
            LegacySiBroadcast legacy = LegacySiBroadcast.open();
            Object message = legacy.createSubscribeMessage(
                ADDON_NAME + "-" + Integer.toHexString(System.identityHashCode(this)),
                alias,
                new Consumer<byte[]>() {
                    @Override
                    public void accept(byte[] bytes) {
                        onLegacySnapshot(bytes);
                    }
                },
                new Consumer<byte[]>() {
                    @Override
                    public void accept(byte[] bytes) {
                        onLegacyEvent(bytes);
                    }
                }
            );
            legacyBroadcast = legacy;
            sendLegacyUserMessage(message);
            legacySubscribed = true;
            log("legacy SI subscription sent alias=" + alias + " loader=" + legacy.loaderName());
        } catch (Throwable t) {
            log("legacy SI subscription unavailable: " + t);
        }
    }

    private void unsubscribeLegacy() {
        LegacySiBroadcast legacy = legacyBroadcast;
        if (!legacySubscribed || legacy == null || api == null) {
            return;
        }
        try {
            sendLegacyUserMessage(legacy.createUnsubscribeMessage());
            log("legacy SI unsubscribe sent alias=" + alias);
        } catch (Throwable t) {
            log("legacy SI unsubscribe failed: " + t);
        } finally {
            legacySubscribed = false;
            legacyBroadcast = null;
        }
    }

    private void sendLegacyUserMessage(Object message) {
        try {
            Object result = api.getProvider().sendUserMessage(message);
            log("legacy SI message sent via provider result=" + result);
            return;
        } catch (Throwable t) {
            log("legacy SI provider send failed: " + t);
        }
        api.sendUserMessage(message);
        log("legacy SI message sent via simplified api");
    }

    private void onLegacySnapshot(byte[] bytes) {
        LegacySiBroadcast legacy = legacyBroadcast;
        if (legacy == null) {
            return;
        }
        try {
            Object snapshot = legacy.deserialize(bytes);
            List<?> events = legacy.snapshotEvents(snapshot);
            String snapshotKind = legacy.snapshotKind(snapshot);
            log("legacy snapshot events=" + events.size() + " kind=" + snapshotKind);
            for (Object event : events) {
                postAsync(toJson(legacy, event, legacy.eventKind(event, snapshotKind), "bookmap_legacy_snapshot"));
            }
        } catch (Throwable t) {
            log("legacy snapshot handling failed: " + t);
        }
    }

    private void onLegacyEvent(byte[] bytes) {
        LegacySiBroadcast legacy = legacyBroadcast;
        if (legacy == null) {
            return;
        }
        try {
            Object event = legacy.deserialize(bytes);
            lastLegacyEventMs.set(System.currentTimeMillis());
            postAsync(toJson(legacy, event, legacy.eventKind(event, null), "bookmap_legacy"));
        } catch (Throwable t) {
            log("legacy event handling failed: " + t);
        }
    }

    private void onSoundAlert(Layer1ApiSoundAlertMessage alert) {
        if (alert == null || alert.textInfo == null) {
            return;
        }
        if (alert.source != null && !SI_PROVIDER.equals(alert.source.getName())) {
            return;
        }
        long lastLegacy = lastLegacyEventMs.get();
        if (lastLegacy > 0L && System.currentTimeMillis() - lastLegacy < 60_000L) {
            return;
        }

        Matcher matcher = SOUND_ALERT_PATTERN.matcher(alert.textInfo);
        if (!matcher.find()) {
            return;
        }

        String kind = matcher.group(1).toLowerCase(Locale.ROOT).startsWith("stop") ? "stop" : "iceberg";
        String parsedAlias = alert.metadata == null ? matcher.group(2) : String.valueOf(alert.metadata);
        String side = matcher.group(3).toLowerCase(Locale.ROOT);
        double price = parseDouble(matcher.group(4), 0.0);
        double size = parseDouble(matcher.group(5), 0.0);
        double pips = pips();
        double sizeMultiplier = sizeMultiplier();
        int rawPrice = pips == 0.0 ? 0 : (int) Math.round(price / pips);
        int rawSize = (int) Math.round(size * sizeMultiplier);
        boolean isBid = "buy".equals(side);
        String eventAlias = parsedAlias == null || parsedAlias.length() == 0 ? alias : parsedAlias;

        postAsync(toJsonValues(
            kind,
            "ALERT",
            "bookmap_sound_alert",
            eventAlias,
            System.currentTimeMillis(),
            null,
            price,
            rawPrice,
            size,
            rawSize,
            size,
            rawSize,
            isBid,
            alert.alertId
        ));
    }

    private EventInterface castSiEvent(Object rawEvent) throws FailedToCastObject {
        String className = rawEvent.getClass().getName();
        if (IcebergEvent.class.getName().equals(className)) {
            return CastUtilities.castObject(rawEvent, IcebergEvent.class);
        }
        if (StopEvent.class.getName().equals(className)) {
            return CastUtilities.castObject(rawEvent, StopEvent.class);
        }
        if (rawEvent instanceof EventInterface) {
            return (EventInterface) rawEvent;
        }
        return null;
    }

    private String eventKind(Object rawEvent) {
        String className = rawEvent.getClass().getName();
        if (StopEvent.class.getName().equals(className) || className.endsWith(".StopEvent")) {
            return "stop";
        }
        if (IcebergEvent.class.getName().equals(className) || className.endsWith(".IcebergEvent")) {
            return "iceberg";
        }
        return "unknown";
    }

    private String toJson(EventInterface event, String eventKind) {
        int rawPrice = event.getPrice();
        int rawSize = event.getSize();
        int rawTotalSize = event.getTotalSize();
        double pips = instrumentInfo == null ? 1.0 : instrumentInfo.pips;
        double sizeMultiplier = instrumentInfo == null || instrumentInfo.sizeMultiplier == 0.0
            ? 1.0
            : instrumentInfo.sizeMultiplier;
        long timeNanos = event.getTime();
        long timeMs = timeNanos / NANOS_PER_MILLI;

        StringBuilder sb = new StringBuilder(384);
        sb.append('{');
        stringField(sb, "type", "bookmap_si_event");
        comma(sb);
        stringField(sb, "symbol", env("NTTOTV_BOOKMAP_SYMBOL", "GC"));
        comma(sb);
        stringField(sb, "contract", env("NTTOTV_BOOKMAP_CONTRACT", "GC"));
        comma(sb);
        stringField(sb, "alias", alias);
        comma(sb);
        stringField(sb, "provider", SI_PROVIDER);
        comma(sb);
        stringField(sb, "source", "bookmap");
        comma(sb);
        stringField(sb, "eventKind", eventKind);
        comma(sb);
        stringField(sb, "eventType", String.valueOf(event.getType()));
        comma(sb);
        numberField(sb, "time", Long.toString(timeMs));
        comma(sb);
        numberField(sb, "timeNanos", Long.toString(timeNanos));
        comma(sb);
        numberField(sb, "price", doubleString(rawPrice * pips));
        comma(sb);
        numberField(sb, "rawPrice", Integer.toString(rawPrice));
        comma(sb);
        numberField(sb, "size", doubleString(rawSize / sizeMultiplier));
        comma(sb);
        numberField(sb, "rawSize", Integer.toString(rawSize));
        comma(sb);
        numberField(sb, "totalSize", doubleString(rawTotalSize / sizeMultiplier));
        comma(sb);
        numberField(sb, "rawTotalSize", Integer.toString(rawTotalSize));
        comma(sb);
        booleanField(sb, "isBid", event.isBid());
        String orderId = event.getOrderId();
        if (orderId != null && orderId.length() > 0) {
            comma(sb);
            stringField(sb, "orderId", orderId);
        }
        sb.append('}');
        return sb.toString();
    }

    private String toJson(LegacySiBroadcast legacy, Object event, String eventKind, String source) throws Exception {
        long rawTime = legacy.longField(event, "time");
        long timeMs = normalizeBookmapTimeMs(rawTime);
        Long timeNanos = Long.valueOf(normalizeBookmapTimeNanos(rawTime));
        int rawPrice = legacy.intField(event, "price");
        int rawSize = legacy.intField(event, "size");
        int rawTotalSize = legacy.intField(event, "totalSize");
        String eventAlias = legacy.stringField(event, "alias");
        if (eventAlias == null || eventAlias.length() == 0) {
            eventAlias = alias;
        }
        return toJsonValues(
            eventKind,
            legacy.stringField(event, "type"),
            source,
            eventAlias,
            timeMs,
            timeNanos,
            rawPrice * pips(),
            rawPrice,
            rawSize / sizeMultiplier(),
            rawSize,
            rawTotalSize / sizeMultiplier(),
            rawTotalSize,
            legacy.booleanField(event, "isBid"),
            legacy.stringField(event, "orderId")
        );
    }

    private String toJsonValues(
        String eventKind,
        String eventType,
        String source,
        String eventAlias,
        long timeMs,
        Long timeNanos,
        double price,
        int rawPrice,
        double size,
        int rawSize,
        double totalSize,
        int rawTotalSize,
        boolean isBid,
        String orderId
    ) {
        StringBuilder sb = new StringBuilder(384);
        sb.append('{');
        stringField(sb, "type", "bookmap_si_event");
        comma(sb);
        stringField(sb, "symbol", env("NTTOTV_BOOKMAP_SYMBOL", "GC"));
        comma(sb);
        stringField(sb, "contract", env("NTTOTV_BOOKMAP_CONTRACT", "GC"));
        comma(sb);
        stringField(sb, "alias", eventAlias);
        comma(sb);
        stringField(sb, "provider", SI_PROVIDER);
        comma(sb);
        stringField(sb, "source", source);
        comma(sb);
        stringField(sb, "eventKind", eventKind == null ? "unknown" : eventKind);
        comma(sb);
        stringField(sb, "eventType", eventType == null ? "UNKNOWN" : eventType);
        comma(sb);
        numberField(sb, "time", Long.toString(timeMs));
        if (timeNanos != null) {
            comma(sb);
            numberField(sb, "timeNanos", Long.toString(timeNanos.longValue()));
        }
        comma(sb);
        numberField(sb, "price", doubleString(price));
        comma(sb);
        numberField(sb, "rawPrice", Integer.toString(rawPrice));
        comma(sb);
        numberField(sb, "size", doubleString(size));
        comma(sb);
        numberField(sb, "rawSize", Integer.toString(rawSize));
        comma(sb);
        numberField(sb, "totalSize", doubleString(totalSize));
        comma(sb);
        numberField(sb, "rawTotalSize", Integer.toString(rawTotalSize));
        comma(sb);
        booleanField(sb, "isBid", isBid);
        if (orderId != null && orderId.length() > 0) {
            comma(sb);
            stringField(sb, "orderId", orderId);
        }
        sb.append('}');
        return sb.toString();
    }

    private void postAsync(String json) {
        httpExecutor.submit(new Runnable() {
            @Override
            public void run() {
                post(json);
            }
        });
    }

    private void post(String json) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(env("NTTOTV_BOOKMAP_BRIDGE_URL", "http://127.0.0.1:8000/api/bookmap/si/events"));
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(1000);
            connection.setReadTimeout(1000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream os = connection.getOutputStream()) {
                os.write(bytes);
            }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                logHttpError("backend returned HTTP " + status);
            }
        } catch (IOException e) {
            logHttpError("POST failed: " + e.getMessage());
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private void logHttpError(String message) {
        long now = System.currentTimeMillis();
        long last = lastHttpErrorLogMs.get();
        if (now - last > 10_000L && lastHttpErrorLogMs.compareAndSet(last, now)) {
            log(message);
        }
    }

    private static String env(String name, String fallback) {
        String value = System.getProperty(name);
        if (value == null || value.trim().isEmpty()) {
            value = System.getenv(name);
        }
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private static boolean isBrapiEnabled() {
        return "1".equals(env("NTTOTV_BOOKMAP_BRAPI_ENABLED", "0"))
            || "true".equalsIgnoreCase(env("NTTOTV_BOOKMAP_BRAPI_ENABLED", "0"));
    }

    private double pips() {
        return instrumentInfo == null ? 1.0 : instrumentInfo.pips;
    }

    private double sizeMultiplier() {
        return instrumentInfo == null || instrumentInfo.sizeMultiplier == 0.0
            ? 1.0
            : instrumentInfo.sizeMultiplier;
    }

    private static long normalizeBookmapTimeMs(long rawTime) {
        if (rawTime >= EPOCH_NANOS_THRESHOLD) {
            return rawTime / NANOS_PER_MILLI;
        }
        if (rawTime >= EPOCH_MICROS_THRESHOLD) {
            return rawTime / 1_000L;
        }
        return rawTime;
    }

    private static long normalizeBookmapTimeNanos(long rawTime) {
        if (rawTime >= EPOCH_NANOS_THRESHOLD) {
            return rawTime;
        }
        if (rawTime >= EPOCH_MICROS_THRESHOLD) {
            return rawTime * 1_000L;
        }
        return rawTime * NANOS_PER_MILLI;
    }

    private static double parseDouble(String value, double fallback) {
        try {
            return Double.parseDouble(value);
        } catch (RuntimeException e) {
            return fallback;
        }
    }

    private static void stringField(StringBuilder sb, String key, String value) {
        quote(sb, key);
        sb.append(':');
        quote(sb, value == null ? "" : value);
    }

    private static void numberField(StringBuilder sb, String key, String value) {
        quote(sb, key);
        sb.append(':').append(value);
    }

    private static void booleanField(StringBuilder sb, String key, boolean value) {
        quote(sb, key);
        sb.append(':').append(value ? "true" : "false");
    }

    private static void comma(StringBuilder sb) {
        sb.append(',');
    }

    private static void quote(StringBuilder sb, String value) {
        sb.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"':
                    sb.append("\\\"");
                    break;
                case '\\':
                    sb.append("\\\\");
                    break;
                case '\b':
                    sb.append("\\b");
                    break;
                case '\f':
                    sb.append("\\f");
                    break;
                case '\n':
                    sb.append("\\n");
                    break;
                case '\r':
                    sb.append("\\r");
                    break;
                case '\t':
                    sb.append("\\t");
                    break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                    break;
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

    private static void log(String message) {
        System.out.println("[NTtoTV Bookmap SI Bridge] " + message);
        try {
            Path path = configuredLogPath();
            Files.createDirectories(path.getParent());
            String line = Instant.now().toString() + " [NTtoTV Bookmap SI Bridge] " + message + System.lineSeparator();
            Files.write(
                path,
                line.getBytes(StandardCharsets.UTF_8),
                StandardOpenOption.CREATE,
                StandardOpenOption.APPEND
            );
        } catch (Throwable ignored) {
        }
    }

    private static Path configuredLogPath() {
        String configured = System.getProperty("NTTOTV_BOOKMAP_BRIDGE_LOG");
        if (configured == null || configured.trim().isEmpty()) {
            configured = System.getenv("NTTOTV_BOOKMAP_BRIDGE_LOG");
        }
        if (configured != null && !configured.trim().isEmpty()) {
            return Paths.get(configured.trim());
        }
        return Paths.get(
            System.getProperty("user.home"),
            "Desktop",
            "NTtoTV",
            "_run_logs",
            "bookmap-si-bridge",
            "raw-bridge.log"
        );
    }

    private static final class LegacySiBroadcast {
        private final ClassLoader loader;
        private final Constructor<?> subscriptionCtor;
        private final Constructor<?> subscribeMessageCtor;
        private final Constructor<?> unsubscribeMessageCtor;
        private final Method serialize;
        private final Method deserialize;
        private final Object allSubscriptionType;
        private Object subscription;

        private LegacySiBroadcast(
            ClassLoader loader,
            Constructor<?> subscriptionCtor,
            Constructor<?> subscribeMessageCtor,
            Constructor<?> unsubscribeMessageCtor,
            Method serialize,
            Method deserialize,
            Object allSubscriptionType
        ) {
            this.loader = loader;
            this.subscriptionCtor = subscriptionCtor;
            this.subscribeMessageCtor = subscribeMessageCtor;
            this.unsubscribeMessageCtor = unsubscribeMessageCtor;
            this.serialize = serialize;
            this.deserialize = deserialize;
            this.allSubscriptionType = allSubscriptionType;
        }

        static LegacySiBroadcast open() throws Exception {
            ClassLoader loader = findLoader();
            Class<?> subscriptionTypeClass = Class.forName(
                "velox.indicators.sionchart.broadcast.SubscriptionType",
                true,
                loader
            );
            Class<?> subscriptionClass = Class.forName(
                "velox.indicators.sionchart.broadcast.Subscription",
                true,
                loader
            );
            Class<?> subscribeMessageClass = Class.forName(
                "velox.indicators.sionchart.broadcast.SubscribeMessage",
                true,
                loader
            );
            Class<?> unsubscribeMessageClass = Class.forName(
                "velox.indicators.sionchart.broadcast.UnsubscribeMessage",
                true,
                loader
            );
            Class<?> helperClass = Class.forName(
                "velox.indicators.sionchart.broadcast.Helper",
                true,
                loader
            );
            Object all = Enum.valueOf(subscriptionTypeClass.asSubclass(Enum.class), "ALL");
            Constructor<?> subscriptionCtor = subscriptionClass.getConstructor(
                String.class,
                String.class,
                subscriptionTypeClass
            );
            Constructor<?> subscribeMessageCtor = subscribeMessageClass.getConstructor(
                byte[].class,
                Consumer.class,
                Consumer.class
            );
            Constructor<?> unsubscribeMessageCtor = unsubscribeMessageClass.getConstructor(byte[].class);
            Method serialize = helperClass.getMethod("serialize", Object.class);
            Method deserialize = helperClass.getMethod("deserialize", byte[].class);
            return new LegacySiBroadcast(
                loader,
                subscriptionCtor,
                subscribeMessageCtor,
                unsubscribeMessageCtor,
                serialize,
                deserialize,
                all
            );
        }

        Object createSubscribeMessage(
            String subscriber,
            String alias,
            Consumer<byte[]> snapshotConsumer,
            Consumer<byte[]> eventConsumer
        ) throws Exception {
            subscription = subscriptionCtor.newInstance(subscriber, alias, allSubscriptionType);
            byte[] bytes = (byte[]) serialize.invoke(null, subscription);
            return subscribeMessageCtor.newInstance(bytes, snapshotConsumer, eventConsumer);
        }

        Object createUnsubscribeMessage() throws Exception {
            if (subscription == null) {
                throw new IllegalStateException("legacy subscription not initialized");
            }
            byte[] bytes = (byte[]) serialize.invoke(null, subscription);
            return unsubscribeMessageCtor.newInstance(bytes);
        }

        Object deserialize(byte[] bytes) throws Exception {
            return deserialize.invoke(null, bytes);
        }

        List<?> snapshotEvents(Object snapshot) throws Exception {
            Object value = fieldValue(snapshot, "events");
            if (value instanceof List) {
                return (List<?>) value;
            }
            return new CopyOnWriteArrayList<Object>();
        }

        String snapshotKind(Object snapshot) throws Exception {
            return stringField(snapshot, "type");
        }

        String eventKind(Object event, String snapshotKind) throws Exception {
            String type = stringField(event, "type");
            if ("STOP".equalsIgnoreCase(type) || "STOPS".equalsIgnoreCase(snapshotKind)) {
                return "stop";
            }
            if ("ICEBERGS".equalsIgnoreCase(snapshotKind)) {
                return "iceberg";
            }
            return "iceberg";
        }

        int intField(Object target, String name) throws Exception {
            return ((Number) fieldValue(target, name)).intValue();
        }

        long longField(Object target, String name) throws Exception {
            return ((Number) fieldValue(target, name)).longValue();
        }

        boolean booleanField(Object target, String name) throws Exception {
            return ((Boolean) fieldValue(target, name)).booleanValue();
        }

        String stringField(Object target, String name) throws Exception {
            Object value = fieldValue(target, name);
            return value == null ? null : String.valueOf(value);
        }

        String loaderName() {
            return loader == null ? "bootstrap" : String.valueOf(loader);
        }

        private static Object fieldValue(Object target, String name) throws Exception {
            Field field = target.getClass().getField(name);
            return field.get(target);
        }

        private static ClassLoader findLoader() throws ClassNotFoundException {
            List<ClassLoader> loaders = new CopyOnWriteArrayList<ClassLoader>();
            addLoader(loaders, Thread.currentThread().getContextClassLoader());
            addLoader(loaders, BookmapSiBridge.class.getClassLoader());
            addLoader(loaders, ClassLoader.getSystemClassLoader());
            for (ClassLoader loader : loaders) {
                try {
                    Class.forName("velox.indicators.sionchart.broadcast.SubscribeMessage", false, loader);
                    Class.forName("velox.indicators.sionchart.broadcast.SubscriptionType", false, loader);
                    return loader;
                } catch (ClassNotFoundException ignored) {
                    // Try the next visible Bookmap strategy class loader.
                }
            }
            throw new ClassNotFoundException("velox.indicators.sionchart.broadcast.SubscribeMessage");
        }

        private static void addLoader(List<ClassLoader> loaders, ClassLoader loader) {
            if (loader == null || loaders.contains(loader)) {
                return;
            }
            loaders.add(loader);
        }
    }
}
