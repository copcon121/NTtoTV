package com.nttotv.bookmap;

import java.util.ArrayList;
import java.util.List;

public final class BookmapFootprintAccumulatorTest {
    private static final long T0_MS = 1_784_716_800_000L;

    public static void main(String[] args) {
        List<BookmapFootprintAccumulator.Bar> bars = new ArrayList<BookmapFootprintAccumulator.Bar>();
        BookmapFootprintAccumulator accumulator = new BookmapFootprintAccumulator(
            0.1,
            1.0,
            bars::add
        );

        accumulator.onTimestamp((T0_MS + 100L) * 1_000_000L);
        assertTrue(accumulator.onTrade(1000.0, 2, true, true, false, false, "a1", "p1"));
        accumulator.onTimestamp((T0_MS + 200L) * 1_000_000L);
        assertTrue(accumulator.onTrade(999.0, 3, false, false, true, false, "a1", "p2"));
        accumulator.onTimestamp((T0_MS + 60_000L) * 1_000_000L);

        assertEquals(1, bars.size(), "first bar count");
        BookmapFootprintAccumulator.Bar first = bars.get(0);
        assertEquals(T0_MS, first.time, "bar time");
        assertDouble(100.0, first.open, "open");
        assertDouble(100.0, first.high, "high");
        assertDouble(99.9, first.low, "low");
        assertDouble(99.9, first.close, "close");
        assertEquals(5L, first.volume, "volume");
        assertEquals(2L, first.buyVolume, "buy volume");
        assertEquals(3L, first.sellVolume, "sell volume");
        assertEquals(-1L, first.delta, "delta");
        assertEquals(2L, first.deltaHigh, "delta high");
        assertEquals(-1L, first.deltaLow, "delta low");
        assertEquals(2L, first.tradeEvents, "trade events");
        assertEquals(1L, first.executionStarts, "execution starts");
        assertEquals(1L, first.executionEnds, "execution ends");
        assertTrue(first.partialStart);
        assertEquals(2, first.rows.size(), "row count");
        assertDouble(100.0, first.rows.get(0).price, "top row price");
        assertEquals(0L, first.rows.get(0).bid, "top row bid");
        assertEquals(2L, first.rows.get(0).ask, "top row ask");
        assertDouble(99.9, first.rows.get(1).price, "bottom row price");
        assertEquals(3L, first.rows.get(1).bid, "bottom row bid");
        assertEquals(0L, first.rows.get(1).ask, "bottom row ask");

        accumulator.onTimestamp((T0_MS + 60_100L) * 1_000_000L);
        accumulator.onTrade(1001.0, 4, true, true, true, false, "a2", "p3");
        accumulator.onTimestamp((T0_MS + 120_000L) * 1_000_000L);
        assertEquals(2, bars.size(), "second bar count");
        assertFalse(bars.get(1).partialStart);

        System.out.println("BookmapFootprintAccumulatorTest passed");
    }

    private static void assertTrue(boolean value) {
        if (!value) {
            throw new AssertionError("expected true");
        }
    }

    private static void assertTrue(boolean value, String message) {
        if (!value) {
            throw new AssertionError(message);
        }
    }

    private static void assertFalse(boolean value) {
        if (value) {
            throw new AssertionError("expected false");
        }
    }

    private static void assertEquals(long expected, long actual, String message) {
        if (expected != actual) {
            throw new AssertionError(message + ": expected=" + expected + " actual=" + actual);
        }
    }

    private static void assertDouble(double expected, double actual, String message) {
        if (Math.abs(expected - actual) > 0.000000001) {
            throw new AssertionError(message + ": expected=" + expected + " actual=" + actual);
        }
    }
}
