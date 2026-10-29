/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.TradeInfo
 *  velox.api.layer1.simplified.DepthDataListener
 *  velox.api.layer1.simplified.MarketByOrderDepthDataListener
 *  velox.api.layer1.simplified.TradeDataListener
 */
package a.a.b.a.a;

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
    private Consumer<String> c = string -> {};
    private Consumer<a.a.b.a.a.b> d = b2 -> {};
    private boolean e = false;
    private b f = null;
    public static final String a = "0";
    public static final UnaryOperator<String> b = string -> string == null || string.isEmpty() ? a : string;
    private final Map<String, a> g = new HashMap<String, a>();

    public void a(Consumer<String> consumer) {
        this.c = consumer;
    }

    public void b(Consumer<a.a.b.a.a.b> consumer) {
        this.d = consumer;
    }

    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        if (this.e && n2 > 0) {
            boolean bl;
            String string = (String)b.apply(tradeInfo.aggressorOrderId);
            boolean bl2 = bl = this.f != null && this.f.b && this.f.c != tradeInfo.isBidAggressor;
            if (bl) {
                this.d.accept(a.a.b.a.a.b.CANCEL);
                this.f = null;
                this.e = false;
            } else if (this.f == null) {
                this.f = new b();
                this.f.a = string;
            } else if (!this.f.b && !this.f.a.equals(string)) {
                this.f.b = true;
                this.f.c = tradeInfo.isBidAggressor;
                this.d.accept(a.a.b.a.a.b.START);
            }
            String string2 = (String)b.apply(tradeInfo.passiveOrderId);
            a a2 = this.g.get(string2);
            if (a2 != null && !a2.b && (a2.b = (a2.a -= n2) < 0)) {
                this.c.accept(string2);
            }
        }
    }

    private void a() {
        if (this.f != null && this.f.b) {
            this.d.accept(a.a.b.a.a.b.END);
        }
        this.f = null;
        this.e = true;
    }

    public void send(String string, boolean bl, int n2, int n3) {
        this.a();
        this.g.put(string, new a(n3));
    }

    public void replace(String string, int n2, int n3) {
        this.a();
        a a2 = this.g.get(string);
        if (!a2.b && a2.a == 0) {
            a2.b = true;
            this.c.accept(string);
        }
        a2.a = n3;
    }

    public void cancel(String string) {
        this.a();
        this.g.remove(string);
    }

    public void onDepth(boolean bl, int n2, int n3) {
        this.a();
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

