/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.TradeInfo
 *  velox.api.layer1.simplified.MarketByOrderDepthDataListener
 *  velox.api.layer1.simplified.TradeDataListener
 */
package a.a.b.a.a;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.UnaryOperator;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.simplified.MarketByOrderDepthDataListener;
import velox.api.layer1.simplified.TradeDataListener;

public class a
implements MarketByOrderDepthDataListener,
TradeDataListener {
    private Consumer<String> c = string -> {};
    private Consumer<Boolean> d = bl -> {};
    private b e = null;
    public static final String a = "0";
    public static final UnaryOperator<String> b = string -> string == null || string.isEmpty() ? a : string;
    private final Map<String, a> f = new HashMap<String, a>();

    public void a(Consumer<String> consumer) {
        this.c = consumer;
    }

    public void b(Consumer<Boolean> consumer) {
        this.d = consumer;
    }

    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        if (n2 > 0) {
            a a2;
            String string = (String)b.apply(tradeInfo.aggressorOrderId);
            if (this.e == null) {
                this.e = new b(null);
                this.e.a = string;
            } else if (!this.e.b && !this.e.a.equals(string)) {
                this.d.accept(this.e.b = true);
            }
            a a3 = this.f.get(b.apply(tradeInfo.passiveOrderId));
            if (a3 != null && !a3.b && (a3.b = ((a2 = a3).a = a2.a - n2) < 0)) {
                this.c.accept((String)b.apply(tradeInfo.passiveOrderId));
            }
        }
    }

    private void a() {
        if (this.e != null && this.e.b) {
            this.d.accept(false);
        }
        this.e = null;
    }

    public void send(String string, boolean bl, int n2, int n3) {
        this.a();
        this.f.put(string, new a(n3, null));
    }

    public void replace(String string, int n2, int n3) {
        this.a();
        a a2 = this.f.get(string);
        if (!a2.b && a2.a == 0) {
            a2.b = true;
            this.c.accept(string);
        }
        a2.a = n3;
    }

    public void cancel(String string) {
        this.a();
        this.f.remove(string);
    }

    private static class a {
        private int a;
        private boolean b = false;

        private a(int n2) {
            this.a = n2;
        }

        /* synthetic */ a(int n2, a.a.b.a.a.b b2) {
            this(n2);
        }
    }

    private static class b {
        private String a;
        private boolean b = false;

        private b() {
        }

        /* synthetic */ b(a.a.b.a.a.b b2) {
            this();
        }
    }
}

