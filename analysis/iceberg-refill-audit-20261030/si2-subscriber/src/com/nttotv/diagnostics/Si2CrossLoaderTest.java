package com.nttotv.diagnostics;

import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Path;
import velox.indicators.sionchart.broadcasting.EventInterface;
import velox.indicators.sionchart.broadcasting.implementations.EventType;

/** Isolated original-JAR DTOs reproduce Bookmap's separate-addon loader. */
public final class Si2CrossLoaderTest {
    @SuppressWarnings({"unchecked", "rawtypes"})
    public static void main(String[] args) throws Exception {
        URL original = Path.of(args[0]).toUri().toURL();
        try (URLClassLoader remote = new URLClassLoader(new URL[]{original}, ClassLoader.getPlatformClassLoader())) {
            Class<?> remoteType = remote.loadClass("velox.indicators.sionchart.broadcasting.implementations.EventType");
            Class<?> remoteIce = remote.loadClass("velox.indicators.sionchart.broadcasting.implementations.IcebergEvent");
            Object detection = Enum.valueOf((Class<Enum>) remoteType, "DETECTION");
            Object input = remoteIce.getConstructor(String.class, remoteType, long.class,
                int.class, int.class, boolean.class, int.class).newInstance(
                    "isolated-id", detection, 1793314323123456789L, 40377, 2, false, 4);
            if (input instanceof EventInterface) throw new AssertionError("Not isolated");
            EventInterface local = Si2PublicEventReader.read(input);
            String json = Si2DiagnosticCaptureV2.eventJson("snapshot", "GCZ6.COMEX@RITHMIC",
                "GCZ6.COMEX@RITHMIC", 0.1, local);
            if (!json.contains("\"orderId\":\"isolated-id\"")
                || !json.contains("\"eventType\":\"DETECTION\"")
                || !json.contains("\"timeNanos\":1793314323123456789")
                || !json.contains("\"time\":1793314323123")
                || !json.contains("\"price\":4037.7")
                || !json.contains("\"eventSize\":2")
                || !json.contains("\"totalSize\":4")
                || !json.contains("\"side\":\"sell\"")) throw new AssertionError(json);
            Object stop = remote.loadClass("velox.indicators.sionchart.broadcasting.implementations.StopEvent")
                .getConstructor(String.class, long.class, int.class, int.class, boolean.class, int.class)
                .newInstance("isolated-stop", 1793314323123456789L, 40377, 5, true, 5);
            if (Si2PublicEventReader.read(stop).getType() != EventType.STOP) throw new AssertionError("STOP type");
            Si2DiagnosticCaptureV2 capture = new Si2DiagnosticCaptureV2();
            capture.recordEvent("snapshot", "GCZ6.COMEX@RITHMIC", stop);
            if (capture.pendingLines() != 0) throw new AssertionError("STOP emitted as ICE");
            capture.recordEvent("snapshot", "GCZ6.COMEX@RITHMIC", input);
            if (capture.pendingLines() != 1) throw new AssertionError("Cross-loader ICE lost");
            try {
                Si2PublicEventReader.read("unrecognized DTO");
                throw new AssertionError("Arbitrary object accepted");
            } catch (IllegalArgumentException expected) { }
            System.out.println("PASS isolated original-JAR DTO: instanceof=false, public getters converted, STOP ignored, arbitrary class rejected");
            System.out.println(json);
        }
    }
}
