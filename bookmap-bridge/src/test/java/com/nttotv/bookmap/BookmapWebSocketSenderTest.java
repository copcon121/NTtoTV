package com.nttotv.bookmap;

public final class BookmapWebSocketSenderTest {
    public static void main(String[] args) {
        testOverflowDropsOldest();
        testReconnectDiscardClearsBacklog();
        System.out.println("BookmapWebSocketSenderTest passed");
    }

    private static void testOverflowDropsOldest() {
        BookmapWebSocketSender sender = new BookmapWebSocketSender(
            "ws://127.0.0.1:8000/ws/bookmap",
            new BookmapWebSocketSender.ConnectedListener() {
                @Override
                public void onConnected() {
                }
            }
        );
        for (int i = 0; i < 20_005; i++) {
            sender.enqueue("{\"sequence\":" + i + "}", true);
        }
        assertEquals(20_000L, sender.queueDepth(), "bounded queue depth");
        assertEquals(5L, sender.droppedOverflow(), "overflow counter");
        sender.close();
    }

    private static void testReconnectDiscardClearsBacklog() {
        BookmapWebSocketSender sender = new BookmapWebSocketSender(
            "ws://127.0.0.1:8000/ws/bookmap",
            new BookmapWebSocketSender.ConnectedListener() {
                @Override
                public void onConnected() {
                }
            }
        );
        sender.enqueue("trade", true);
        sender.enqueue("heartbeat", true);
        sender.enqueue("snapshot", false);
        sender.discardQueuedFrames();
        assertEquals(0L, sender.queueDepth(), "reconnect queue depth");
        assertEquals(3L, sender.droppedStale(), "reconnect stale counter");
        sender.close();
    }

    private static void assertEquals(long expected, long actual, String label) {
        if (expected != actual) {
            throw new AssertionError(label + ": expected=" + expected + " actual=" + actual);
        }
    }
}
