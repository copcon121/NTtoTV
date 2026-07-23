package com.nttotv.bookmap;

import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.annotations.Layer1ApiVersion;
import velox.api.layer1.annotations.Layer1ApiVersionValue;
import velox.api.layer1.annotations.Layer1SimpleAttachable;
import velox.api.layer1.annotations.Layer1StrategyName;
import velox.api.layer1.simplified.Api;
import velox.api.layer1.simplified.InitialState;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;

@Layer1SimpleAttachable
@Layer1StrategyName("NTtoTV Bookmap SI Raw Bridge")
@Layer1ApiVersion(Layer1ApiVersionValue.VERSION2)
public class BookmapSiRawBridge extends BookmapSiBridge {
    static {
        fileLog("class loaded");
    }

    @Override
    public void initialize(String alias, InstrumentInfo info, Api api, InitialState initialState) {
        fileLog("initialize entry alias=" + alias);
        super.initialize(alias, info, api, initialState);
        fileLog("initialize exit alias=" + alias);
    }

    @Override
    public void stop() {
        fileLog("stop entry");
        super.stop();
        fileLog("stop exit");
    }

    @Override
    public void onUserMessage(Object message) {
        super.onUserMessage(message);
    }

    private static void fileLog(String message) {
        try {
            Path path = configuredLogPath();
            Files.createDirectories(path.getParent());
            String line = Instant.now().toString() + " [NTtoTV Bookmap SI Raw Bridge] " + message + System.lineSeparator();
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
}
