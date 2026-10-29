/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.common.Log
 *  velox.api.layer1.data.TradeInfo
 *  velox.api.layer1.simplified.MarketByOrderDepthDataListener
 *  velox.api.layer1.simplified.TimeListener
 *  velox.api.layer1.simplified.TradeDataListener
 */
package velox.indicators.sionchart;

import a.a.b.a.a.b;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import velox.api.layer1.common.Log;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.simplified.MarketByOrderDepthDataListener;
import velox.api.layer1.simplified.TimeListener;
import velox.api.layer1.simplified.TradeDataListener;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.a.n;
import velox.indicators.sionchart.a.t;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.g_0;
import velox.indicators.sionchart.k;
import velox.indicators.sionchart.l;

/*
 * Renamed from velox.indicators.sionchart.E
 */
public class e_0
implements MarketByOrderDepthDataListener,
TimeListener,
TradeDataListener {
    long a;
    final List<g_0> b = new ArrayList<g_0>();
    g_0 c = null;
    private boolean e = false;
    private final TreeMap<Integer, Map<String, n>> f = new TreeMap();
    private final Map<String, l> g = new HashMap<String, l>();
    private final SitIndicator h;
    private final e i;
    final boolean d;

    e_0(SitIndicator sitIndicator, boolean bl) {
        this.h = sitIndicator;
        this.d = bl;
        this.i = sitIndicator.e();
    }

    e_0(SitIndicator sitIndicator) {
        this(sitIndicator, false);
    }

    public void send(String string, boolean bl, int n2, int n3) {
    }

    public void replace(String string, int n2, int n3) {
    }

    public void cancel(String string) {
    }

    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        if (this.e && n2 > 0) {
            l l2 = this.g.get(tradeInfo.aggressorOrderId);
            if (l2 == null) {
                l2 = new l(tradeInfo.aggressorOrderId, tradeInfo.isBidAggressor, 0, 0, 0L, this.f);
                this.g.put(tradeInfo.aggressorOrderId, l2);
            }
            k k2 = new k(OrderEventType.STOP, this.a, (int)d2, n2, l2);
            this.c.a(k2, tradeInfo.isBidAggressor);
            this.h.a(k2);
            if (this.d) {
                Log.info((String)("Stop id: " + tradeInfo.aggressorOrderId + ", passive id: " + tradeInfo.passiveOrderId));
            }
        }
    }

    public void onTimestamp(long l2) {
        this.a = l2;
    }

    public void a(b b2) {
        switch (b2) {
            case START: {
                this.a();
                break;
            }
            case END: {
                this.b();
                break;
            }
            case CANCEL: {
                this.c();
                break;
            }
            default: {
                throw new RuntimeException("Unknown stop chain state: " + b2);
            }
        }
    }

    private void a() {
        if (!this.e) {
            this.c = new g_0();
            this.e = true;
        }
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private void b() {
        if (this.e) {
            this.e = false;
            List<g_0> list = this.b;
            synchronized (list) {
                this.b.add(this.c);
            }
            if (this.i.stopsAlertEnabled && this.c.b >= this.i.stopsAlertThreshold && this.a == this.h.h.getProvider().getCurrentTime()) {
                this.h.k.b(this.c.b(), this.c.b, this.c.c, true);
            }
        }
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private void c() {
        if (this.e) {
            this.e = false;
            Object object = this.b;
            synchronized (object) {
                this.b.remove(this.c);
            }
            object = "Inconsistent MBO data for " + this.h.j + ". Stops and icebergs detection may be inaccurate.";
            Log.warn((String)(t.a(this.a) + " (" + this.a + ") " + (String)object));
            this.h.b((String)object);
        }
    }
}

