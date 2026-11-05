package com.nttotv.diagnostics;

import com.bookmap.addons.broadcasting.api.view.BrDataStructureInterface;
import com.bookmap.addons.broadcasting.api.view.BroadcastSettings;
import com.bookmap.addons.broadcasting.api.view.BroadcasterConsumer;
import com.bookmap.addons.broadcasting.api.view.GeneratorInfo;
import com.bookmap.addons.broadcasting.implementations.view.BroadcastFactory;
import velox.api.layer1.annotations.Layer1ApiVersion;
import velox.api.layer1.annotations.Layer1ApiVersionValue;
import velox.api.layer1.annotations.Layer1SimpleAttachable;
import velox.api.layer1.annotations.Layer1StrategyName;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.simplified.Api;
import velox.api.layer1.simplified.CustomModule;
import velox.api.layer1.simplified.InitialState;
import velox.api.layer1.simplified.NoAutosubscription;
import velox.indicators.sionchart.broadcasting.EventInterface;
import velox.indicators.sionchart.broadcasting.implementations.EventType;
import velox.indicators.sionchart.broadcasting.implementations.IcebergEvent;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Normal Bookmap addon consumer of published SI 2 events. It has no market-data
 * listeners, no market-data requests, no trading methods, and no network code.
 */
@NoAutosubscription
@Layer1SimpleAttachable
@Layer1StrategyName("NTtoTV SI2 Diagnostic Capture V2")
@Layer1ApiVersion(Layer1ApiVersionValue.VERSION2)
public final class Si2DiagnosticCaptureV2 implements CustomModule {
    static final String PROVIDER = "velox.indicators.sionchart.SitIndicator";
    private static final Path OUTPUT = Path.of(
        "C:/Users/Administrator/Desktop/NTtoTV/analysis/iceberg-refill-audit-20261030/bookmap-si-capture");
    private static final long LOOKBACK_NANOS = TimeUnit.MINUTES.toNanos(90);
    private static final int MAX_EVENTS = 50_000;
    private final BlockingQueue<String> lines = new ArrayBlockingQueue<>(5000);
    private final AtomicLong overflow = new AtomicLong();
    private final Set<String> seen = new HashSet<>();
    private final Set<String> liveSubscribed = new HashSet<>();
    private final Set<String> snapshotDone = new HashSet<>();
    private volatile boolean active;
    private volatile boolean providerReady;
    private volatile boolean connecting;
    private String alias;
    private double tickSize;
    private BroadcasterConsumer consumer;
    private Thread worker;
    private BufferedWriter writer;
    private String lastState = "";

    @Override
    public void initialize(String instrumentAlias, InstrumentInfo info, Api api, InitialState initial) {
        alias = instrumentAlias == null ? "" : instrumentAlias;
        if (!alias.startsWith("GCZ6.") || !alias.endsWith("@RITHMIC")) {
            throw new IllegalArgumentException("Attach only to GCZ6 COMEX Rithmic");
        }
        tickSize = info != null && info.pips > 0 ? info.pips : 0.1;
        try {
            Files.createDirectories(OUTPUT);
            Path output = OUTPUT.resolve("si2-v2-" + Instant.now().toString().replace(':', '-')
                + "-" + UUID.randomUUID().toString().substring(0, 8) + ".jsonl");
            writer = Files.newBufferedWriter(output, StandardCharsets.UTF_8,
                StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
            writer.write("{\"kind\":\"capture_start\",\"alias\":" + quote(alias)
                + ",\"tickSize\":" + tickSize + ",\"receivedAt\":" + System.currentTimeMillis()
                + ",\"lookbackMinutes\":90,\"maxEvents\":" + MAX_EVENTS + "}\n");
            writer.flush();
            BroadcastSettings localSettings = BroadcastFactory.getDefaultSettings();
            localSettings.setPackagesToBeScannedOnBrApiAnnotations("velox.indicators.sionchart.broadcasting");
            consumer = BroadcastFactory.getBroadcasterConsumer(api.getProvider(),
                "NTtoTV SI2 Diagnostic Capture V2", getClass(), localSettings);
            // Do not call checkUserLicenses with a manufactured expiry. This
            // unrestricted diagnostic consumer obeys the provider's published
            // license/availability and the library's normal connection checks.
            active = true;
            consumer.start();
            worker = new Thread(this::run, "nttotv-si2-diagnostic-capture");
            worker.setDaemon(true);
            worker.start();
        } catch (Exception error) {
            stop();
            throw new IllegalStateException("SI diagnostic initialization failed: "
                + error.getClass().getSimpleName());
        }
    }

    private void run() {
        long nextPoll = 0;
        long lastFlush = 0;
        long written = 0;
        long expires = System.currentTimeMillis() + TimeUnit.HOURS.toMillis(2);
        try {
            while (active && written < MAX_EVENTS && System.currentTimeMillis() < expires) {
                long now = System.currentTimeMillis();
                if (now >= nextPoll) {
                    inspectProvider();
                    nextPoll = now + 2000;
                }
                String line = lines.poll(150, TimeUnit.MILLISECONDS);
                if (line != null) {
                    if (seen.add(line)) {
                        writer.write(line);
                        writer.newLine();
                        written++;
                    }
                }
                if (now - lastFlush >= 1000) {
                    writer.flush();
                    lastFlush = now;
                }
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        } catch (Throwable error) {
            try {
                writer.write("{\"kind\":\"error\",\"class\":"
                    + quote(error.getClass().getName()) + "}\n");
            } catch (Exception ignored) { }
        } finally {
            active = false;
            try {
                if (consumer != null) consumer.finish();
            } catch (Exception ignored) { }
            try {
                writer.write("{\"kind\":\"capture_end\",\"written\":" + written
                    + ",\"queueOverflow\":" + overflow.get() + "}\n");
                writer.close();
            } catch (Exception ignored) { }
        }
    }

    private void inspectProvider() {
        List<String> available = consumer.getAvailableProviders();
        if (!available.contains(PROVIDER)
            || !consumer.providerIsLicensedToBroadcast(PROVIDER).orElse(false)) {
            providerReady = false;
            connecting = false;
            liveSubscribed.clear();
            snapshotDone.clear();
            state("provider_unavailable_or_unlicensed");
            return;
        }
        if (!providerReady) {
            if (!connecting) {
                connecting = true;
                state("connecting_to_published_provider");
                consumer.connectToProvider(PROVIDER, connected -> {
                    providerReady = connected;
                    if (!connected) connecting = false;
                    enqueue("{\"kind\":\"connection\",\"connected\":" + connected + "}");
                });
            }
            return;
        }
        state("provider_connected");
        for (GeneratorInfo generator : consumer.getGeneratorsInfo(PROVIDER)) {
            String name = generator.getGeneratorName();
            boolean aliasMatches = alias.equals(name)
                || generator.getAliases() != null && generator.getAliases().contains(alias);
            if (!aliasMatches) continue;
            if (liveSubscribed.add(name)) {
                consumer.subscribeToLiveData(PROVIDER, name,
                    event -> recordEvent("live", name, event),
                    connected -> enqueue("{\"kind\":\"live_connection\",\"generator\":"
                        + quote(name) + ",\"connected\":" + connected + "}"));
            }
            if (!snapshotDone.contains(name)) {
                BrDataStructureInterface data = consumer.getDataStructureInterface(PROVIDER);
                if (data == null) continue;
                long to = System.currentTimeMillis() * 1_000_000L;
                long from = to - LOOKBACK_NANOS;
                List<Object> events = data.get(IcebergEvent.class, name, from, to, alias);
                if (events == null) continue;
                enqueue("{\"kind\":\"snapshot\",\"generator\":" + quote(name)
                    + ",\"fromNanos\":" + from + ",\"toNanos\":" + to
                    + ",\"returnedEvents\":" + events.size() + "}");
                for (Object event : events) recordEvent("snapshot", name, event);
                snapshotDone.add(name);
            }
        }
    }

    private void state(String state) {
        if (state.equals(lastState)) return;
        lastState = state;
        enqueue("{\"kind\":\"status\",\"state\":" + quote(state)
            + ",\"receivedAt\":" + System.currentTimeMillis() + "}");
    }

    void recordEvent(String capture, String generator, Object value) {
        try {
            EventInterface event = Si2PublicEventReader.read(value);
            if (event.getType() == EventType.STOP) return;
            enqueue(eventJson(capture, generator, alias, tickSize, event));
        } catch (ReflectiveOperationException | IllegalArgumentException error) {
            enqueue("{\"kind\":\"unsupported_event_class\",\"class\":"
                + quote(value == null ? "null" : value.getClass().getName())
                + ",\"errorClass\":" + quote(error.getClass().getName()) + "}");
        }
    }

    int pendingLines() { return lines.size(); }

    static String eventJson(String capture, String generator, String alias,
                            double tickSize, EventInterface event) {
        return "{\"kind\":\"iceberg_event\",\"capture\":" + quote(capture)
            + ",\"generator\":" + quote(generator) + ",\"alias\":" + quote(alias)
            + ",\"orderId\":" + quote(event.getOrderId())
            + ",\"eventType\":" + quote(event.getType().name())
            + ",\"timeNanos\":" + event.getTime()
            + ",\"time\":" + Math.floorDiv(event.getTime(), 1_000_000L)
            + ",\"priceLevel\":" + event.getPrice()
            + ",\"price\":" + Math.round(event.getPrice() * tickSize * 1e8) / 1e8
            + ",\"side\":" + quote(event.isBid() ? "buy" : "sell")
            + ",\"eventSize\":" + event.getSize()
            + ",\"totalSize\":" + event.getTotalSize() + "}";
    }

    private void enqueue(String line) {
        if (!lines.offer(line)) overflow.incrementAndGet();
    }

    static String quote(String value) {
        if (value == null) return "null";
        StringBuilder result = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '"' || c == '\\') result.append('\\').append(c);
            else if (c < 0x20) result.append(String.format("\\u%04x", (int)c));
            else result.append(c);
        }
        return result.append('"').toString();
    }

    @Override
    public void stop() {
        active = false;
        Thread local = worker;
        if (local != null) {
            local.interrupt();
            try { local.join(3000); }
            catch (InterruptedException error) { Thread.currentThread().interrupt(); }
        } else {
            try { if (consumer != null) consumer.finish(); }
            catch (Exception ignored) { }
            try { if (writer != null) writer.close(); }
            catch (Exception ignored) { }
        }
    }
}
