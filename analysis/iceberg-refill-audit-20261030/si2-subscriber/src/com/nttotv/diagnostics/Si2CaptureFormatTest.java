package com.nttotv.diagnostics;

import velox.indicators.sionchart.broadcasting.implementations.EventType;
import velox.indicators.sionchart.broadcasting.implementations.IcebergEvent;

/** Offline format check only; no Bookmap/provider startup. */
public final class Si2CaptureFormatTest {
    public static void main(String[] args) {
        IcebergEvent event = new IcebergEvent("test-id", EventType.DETECTION,
            1793314323123456789L, 40377, 2, false, 4);
        String value = Si2DiagnosticCapture.eventJson("snapshot", "GCZ6.COMEX@RITHMIC",
            "GCZ6.COMEX@RITHMIC", 0.1, event);
        if (!value.contains("\"price\":4037.7")
            || !value.contains("\"time\":1793314323123")
            || !value.contains("\"eventSize\":2")
            || !value.contains("\"totalSize\":4")
            || !value.contains("\"side\":\"sell\"")) throw new AssertionError(value);
        if (!Si2DiagnosticCapture.quote("a\"b\\c\n").equals("\"a\\\"b\\\\c\\u000a\"")) {
            throw new AssertionError("JSON escaping");
        }
        System.out.println(value);
    }
}
