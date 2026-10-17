package com.nttotv.bookmap;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.concurrent.CompletionStage;

final class BookmapWebSocketSender implements AutoCloseable {
    interface ConnectedListener {
        void onConnected();
    }

    interface MessageListener {
        void onMessage(String message);
    }

    private static final int MAX_QUEUE = 20_000;
    private static final long MAX_FRAME_AGE_MS = 2_000L;

    private static final class Frame {
        final String json;
        final long createdAt;
        final boolean staleSensitive;

        Frame(String json, long createdAt, boolean staleSensitive) {
            this.json = json;
            this.createdAt = createdAt;
            this.staleSensitive = staleSensitive;
        }
    }

    private final Object gate = new Object();
    private final ArrayDeque<Frame> queue = new ArrayDeque<Frame>();
    private final URI uri;
    private final ConnectedListener connectedListener;
    private final MessageListener messageListener;
    private final Thread worker;
    private volatile boolean running = true;
    private volatile WebSocket socket;
    private volatile boolean open;
    private boolean connectedOnce;
    private long droppedOverflow;
    private long droppedStale;

    BookmapWebSocketSender(String url, ConnectedListener connectedListener) {
        this(url, connectedListener, null);
    }

    BookmapWebSocketSender(
        String url,
        ConnectedListener connectedListener,
        MessageListener messageListener
    ) {
        uri = URI.create(url);
        this.connectedListener = connectedListener;
        this.messageListener = messageListener;
        worker = new Thread(new Runnable() {
            @Override
            public void run() {
                runLoop();
            }
        }, "NTtoTV-Bookmap-WebSocket");
        worker.setDaemon(true);
    }

    void start() {
        worker.start();
    }

    void enqueue(String json, boolean staleSensitive) {
        if (json == null || json.isEmpty() || !running) {
            return;
        }
        synchronized (gate) {
            while (queue.size() >= MAX_QUEUE) {
                queue.removeFirst();
                droppedOverflow += 1L;
            }
            queue.addLast(new Frame(json, System.currentTimeMillis(), staleSensitive));
            gate.notifyAll();
        }
    }

    int queueDepth() {
        synchronized (gate) {
            return queue.size();
        }
    }

    long droppedOverflow() {
        synchronized (gate) {
            return droppedOverflow;
        }
    }

    long droppedStale() {
        synchronized (gate) {
            return droppedStale;
        }
    }

    private void runLoop() {
        long backoffMs = 250L;
        while (running) {
            try {
                connect();
                backoffMs = 250L;
                if (connectedOnce) {
                    discardQueuedFrames();
                }
                connectedOnce = true;
                connectedListener.onConnected();
                while (running && open) {
                    Frame frame = takeFrame();
                    if (frame == null) {
                        continue;
                    }
                    if (
                        frame.staleSensitive
                            && System.currentTimeMillis() - frame.createdAt > MAX_FRAME_AGE_MS
                    ) {
                        synchronized (gate) {
                            droppedStale += 1L;
                        }
                        continue;
                    }
                    WebSocket current = socket;
                    if (current == null) {
                        break;
                    }
                    current.sendText(frame.json, true).join();
                }
            } catch (Throwable ignored) {
                open = false;
                socket = null;
            }
            if (!running) {
                break;
            }
            try {
                Thread.sleep(backoffMs);
            } catch (InterruptedException ignored) {
            }
            backoffMs = Math.min(5_000L, backoffMs * 2L);
        }
    }

    private void connect() {
        WebSocket created = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3L))
            .build()
            .newWebSocketBuilder()
            .connectTimeout(Duration.ofSeconds(3L))
            .buildAsync(uri, new Listener())
            .join();
        socket = created;
        open = true;
    }

    private Frame takeFrame() throws InterruptedException {
        synchronized (gate) {
            while (running && open && queue.isEmpty()) {
                gate.wait(500L);
            }
            return queue.pollFirst();
        }
    }

    void discardQueuedFrames() {
        synchronized (gate) {
            droppedStale += queue.size();
            queue.clear();
        }
    }

    @Override
    public void close() {
        running = false;
        open = false;
        synchronized (gate) {
            queue.clear();
            gate.notifyAll();
        }
        WebSocket current = socket;
        if (current != null) {
            try {
                current.sendClose(WebSocket.NORMAL_CLOSURE, "stopped").join();
            } catch (Throwable ignored) {
            }
        }
        worker.interrupt();
    }

    private final class Listener implements WebSocket.Listener {
        private final StringBuilder incoming = new StringBuilder();

        @Override
        public void onOpen(WebSocket webSocket) {
            open = true;
            webSocket.request(1L);
        }

        @Override
        public CompletionStage<?> onText(
            WebSocket webSocket,
            CharSequence data,
            boolean last
        ) {
            incoming.append(data);
            if (last) {
                String message = incoming.toString();
                incoming.setLength(0);
                if (messageListener != null) {
                    try {
                        messageListener.onMessage(message);
                    } catch (Throwable ignored) {
                    }
                }
            }
            webSocket.request(1L);
            return null;
        }

        @Override
        public CompletionStage<?> onClose(
            WebSocket webSocket,
            int statusCode,
            String reason
        ) {
            open = false;
            return null;
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            open = false;
        }
    }
}
