/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.common.NanoClock
 *  velox.api.layer1.data.TradeInfo
 *  velox.api.layer1.simplified.MarketByOrderDepthDataListener
 *  velox.api.layer1.simplified.TradeDataListener
 */
package com.bookmap.a.a.a;

import com.bookmap.a.a.a.c;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import velox.api.layer1.common.NanoClock;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.simplified.MarketByOrderDepthDataListener;
import velox.api.layer1.simplified.TradeDataListener;

public class b
implements MarketByOrderDepthDataListener,
TradeDataListener {
    private Consumer<c> a;
    private Consumer<c> b;
    private long c = 0L;
    private boolean d = true;
    private long e = 0L;
    private long f = 0L;
    private int g;
    private c h = null;
    private final Map<String, c> i = new HashMap<String, c>();

    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        if (n2 > 0) {
            this.a(true);
        }
        this.g = (int)d2;
        c c2 = this.i.get(tradeInfo.passiveOrderId);
        if (c2 != null) {
            c2.a(n2);
        }
    }

    public void send(String string, boolean bl, int n2, int n3) {
        c c2 = new c(string, bl, n2, n3);
        this.i.put(string, c2);
        if (this.h != null && NanoClock.currentTimeNanos() - this.e < TimeUnit.MILLISECONDS.toNanos(50L) && this.f == this.c && this.h.a() == n3 && this.h.c == n2 && this.g == n2 && this.h.b == bl) {
            if (!this.h.e) {
                this.b.accept(this.h);
            }
            this.a.accept(c2);
            c2.e = true;
        }
        this.a(false);
    }

    public void replace(String string, int n2, int n3) {
        c c2 = this.i.get(string);
        c2.a(n2, n3);
        this.a(false);
    }

    public void cancel(String string) {
        this.h = this.i.remove(string);
        if (this.h != null && this.h.b() == 0) {
            this.e = NanoClock.currentTimeNanos();
            this.f = this.c;
        } else {
            this.h = null;
        }
        this.a(false);
    }

    private void a(boolean bl) {
        if (this.d != bl) {
            ++this.c;
            this.d = bl;
        }
    }

    public void a(Consumer<c> consumer) {
        this.a = consumer;
    }

    public void b(Consumer<c> consumer) {
        this.b = consumer;
    }
}

