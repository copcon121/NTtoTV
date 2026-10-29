/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.TradeInfo
 *  velox.api.layer1.simplified.DepthDataListener
 *  velox.api.layer1.simplified.MarketByOrderDepthDataListener
 *  velox.api.layer1.simplified.TradeDataListener
 */
package com.bookmap.a.a.a;

import com.bookmap.a.a.a.d;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.UnaryOperator;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.simplified.DepthDataListener;
import velox.api.layer1.simplified.MarketByOrderDepthDataListener;
import velox.api.layer1.simplified.TradeDataListener;

public class a
implements DepthDataListener,
MarketByOrderDepthDataListener,
TradeDataListener {
    private Consumer<String> e = string -> {};
    protected Consumer<d> a = d2 -> {};
    protected boolean b = false;
    private b f = null;
    public static final String c = "0";
    public static final UnaryOperator<String> d = string -> string == null || string.isEmpty() ? c : string;
    private final Map<String, a> g = new HashMap<String, a>();

    public void a(Consumer<String> consumer) {
        this.e = consumer;
    }

    public void b(Consumer<d> consumer) {
        this.a = consumer;
    }

    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        if (this.b && n2 > 0) {
            boolean bl;
            String string = (String)d.apply(tradeInfo.aggressorOrderId);
            boolean bl2 = bl = this.f != null && this.f.b && this.f.c != tradeInfo.isBidAggressor;
            if (bl) {
                this.a.accept(com.bookmap.a.a.a.d.CANCEL);
                this.f = null;
                this.b = false;
            } else if (this.f == null) {
                this.f = new b();
                this.f.a = string;
            } else if (!this.f.b && !this.f.a.equals(string)) {
                this.f.b = true;
                this.f.c = tradeInfo.isBidAggressor;
                this.a.accept(com.bookmap.a.a.a.d.START);
            }
            String string2 = (String)d.apply(tradeInfo.passiveOrderId);
            a a2 = this.g.get(string2);
            if (a2 != null && !a2.b && (a2.b = (a2.a -= n2) < 0)) {
                this.e.accept(string2);
            }
        }
    }

    protected void a(boolean bl) {
        if (this.f != null && this.f.b) {
            this.a.accept(com.bookmap.a.a.a.d.END);
        }
        this.f = null;
        if (bl) {
            this.b = true;
        }
    }

    public void send(String string, boolean bl, int n2, int n3) {
        this.a(true);
        this.g.put(string, new a(n3));
    }

    public void replace(String string, int n2, int n3) {
        this.a(true);
        a a2 = this.g.get(string);
        if (!a2.b && a2.a == 0) {
            a2.b = true;
            this.e.accept(string);
        }
        a2.a = n3;
    }

    public void cancel(String string) {
        this.a(true);
        this.g.remove(string);
    }

    public void onDepth(boolean bl, int n2, int n3) {
        this.a(false);
    }

    private static class b {
        private String a;
        private boolean b = false;
        private boolean c;

        private b() {
        }
    }

    private static class a {
        private int a;
        private boolean b = false;

        private a(int n2) {
            this.a = n2;
        }
    }
}

