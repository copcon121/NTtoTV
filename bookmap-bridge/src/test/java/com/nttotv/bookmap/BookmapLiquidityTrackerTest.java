package com.nttotv.bookmap;

import java.util.ArrayList;
import java.util.List;

public final class BookmapLiquidityTrackerTest {
    private static final long T0_MS = 1_784_716_800_000L;

    public static void main(String[] args) {
        testRuntimeConfig();
        List<BookmapLiquidityTracker.Event> events =
            new ArrayList<BookmapLiquidityTracker.Event>();
        BookmapLiquidityTracker tracker = new BookmapLiquidityTracker(
            0.1,
            1.0,
            new BookmapLiquidityTracker.Config(
                300,
                20,
                80,
                500,
                1,
                10,
                500,
                3,
                80,
                30_000_000_000L,
                50,
                500_000_000L
            ),
            events::add
        );

        long t0 = T0_MS * 1_000_000L;
        tracker.onDepth(true, 1000, 100, t0);
        tracker.onDepth(false, 1001, 100, t0);
        tracker.onDepth(true, 999, 450, t0);
        tracker.startRealtime(t0);

        tracker.onDepth(true, 980, 350, t0 + 1_000_000L);
        BookmapLiquidityTracker.Event relative = find(events, "relative", "added");
        assertEquals("bid", relative.side, "relative side");
        assertEquals(20, relative.domDistance, "relative DOM distance");
        assertEquals(350, relative.change, "relative change");

        tracker.onDepth(true, 999, 510, t0 + 2_000_000L);
        BookmapLiquidityTracker.Event absolute = find(events, "absolute", "crossed");
        assertEquals(510, absolute.size, "absolute size");
        tracker.onDepth(true, 999, 480, t0 + 3_000_000L);
        tracker.onDepth(true, 999, 520, t0 + 4_000_000L);
        assertEquals(1, count(events, "absolute", "crossed"), "absolute hysteresis");
        tracker.onDepth(true, 999, 440, t0 + 5_000_000L);
        tracker.onDepth(true, 999, 530, t0 + 6_000_000L);
        assertEquals(2, count(events, "absolute", "crossed"), "absolute rearm");

        tracker.onDepth(true, 995, 600, t0 + 10_000_000L);
        tracker.onTimestamp(t0 + 30_010_000_000L);
        BookmapLiquidityTracker.Event start = find(events, "long_term", "start");
        assertEquals(600, start.size, "long-term start size");
        assertTrue(start.lineId != null && !start.lineId.isEmpty(), "long-term line id");
        assertEquals(1, tracker.activeLineCount(), "active line count");

        tracker.onDepth(true, 995, 670, t0 + 30_600_000_000L);
        assertEquals(1, count(events, "long_term", "update"), "long-term update");
        assertEquals(1, tracker.snapshots().size(), "long-term snapshot");
        tracker.onDepth(true, 995, 440, t0 + 31_200_000_000L);
        BookmapLiquidityTracker.Event end = find(events, "long_term", "end");
        assertEquals(440, end.size, "long-term end size");
        assertEquals(0, tracker.activeLineCount(), "ended line count");

        String json = BookmapMarketDataBridge.liquidityJson(
            start,
            "GCZ6.COMEX@RITHMIC",
            "GC",
            "GC 12-26",
            T0_MS + 31_000L,
            7L
        );
        assertContains(json, "\"type\":\"liquidity\"", "liquidity type");
        assertContains(json, "\"eventKind\":\"long_term\"", "liquidity kind");
        assertContains(json, "\"lineId\":\"bid:995:", "liquidity line id");

        System.out.println("BookmapLiquidityTrackerTest passed");
    }

    private static void testRuntimeConfig() {
        List<BookmapLiquidityTracker.Event> events =
            new ArrayList<BookmapLiquidityTracker.Event>();
        BookmapLiquidityTracker tracker = new BookmapLiquidityTracker(
            0.1,
            1.0,
            new BookmapLiquidityTracker.Config(
                300, 20, 80, 500, 1, 10, 500, 1, 80,
                30_000_000_000L, 50, 500_000_000L
            ),
            events::add
        );
        long t0 = T0_MS * 1_000_000L;
        tracker.onDepth(true, 1000, 100, t0);
        tracker.onDepth(false, 1001, 100, t0);
        tracker.startRealtime(t0);
        tracker.updateConfig(
            new BookmapLiquidityTracker.Config(
                false, 300, 20, 80,
                false, 500, 1, 10,
                false, 500, 1, 80,
                30_000_000_000L, 50, 500_000_000L
            ),
            t0
        );
        tracker.onDepth(true, 980, 400, t0 + 1_000_000L);
        assertEquals(0, events.size(), "disabled runtime config");

        tracker.updateConfig(
            new BookmapLiquidityTracker.Config(
                true, 300, 20, 80,
                false, 500, 1, 10,
                false, 500, 1, 80,
                30_000_000_000L, 50, 500_000_000L
            ),
            t0 + 2_000_000L
        );
        tracker.onDepth(true, 980, 0, t0 + 3_000_000L);
        assertEquals(1, count(events, "relative", "removed"), "enabled runtime config");
    }

    private static BookmapLiquidityTracker.Event find(
        List<BookmapLiquidityTracker.Event> events,
        String kind,
        String action
    ) {
        for (BookmapLiquidityTracker.Event event : events) {
            if (kind.equals(event.eventKind) && action.equals(event.action)) {
                return event;
            }
        }
        throw new AssertionError("missing event " + kind + "/" + action);
    }

    private static int count(
        List<BookmapLiquidityTracker.Event> events,
        String kind,
        String action
    ) {
        int count = 0;
        for (BookmapLiquidityTracker.Event event : events) {
            if (kind.equals(event.eventKind) && action.equals(event.action)) {
                count += 1;
            }
        }
        return count;
    }

    private static void assertEquals(long expected, long actual, String label) {
        if (expected != actual) {
            throw new AssertionError(label + ": expected=" + expected + " actual=" + actual);
        }
    }

    private static void assertEquals(String expected, String actual, String label) {
        if (!expected.equals(actual)) {
            throw new AssertionError(label + ": expected=" + expected + " actual=" + actual);
        }
    }

    private static void assertTrue(boolean value, String label) {
        if (!value) {
            throw new AssertionError(label);
        }
    }

    private static void assertContains(String value, String expected, String label) {
        if (value == null || !value.contains(expected)) {
            throw new AssertionError(label + ": missing=" + expected + " value=" + value);
        }
    }
}
