/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.common.Log
 *  velox.api.layer1.data.TradeInfo
 *  velox.api.layer1.simplified.TimeListener
 *  velox.api.layer1.simplified.TradeDataListener
 */
package velox.indicators.sionchart;

import com.bookmap.a.a.a.d;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import velox.api.layer1.common.Log;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.simplified.TimeListener;
import velox.api.layer1.simplified.TradeDataListener;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.b.n;
import velox.indicators.sionchart.b.t;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.g_0;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.l;
import velox.indicators.sionchart.m;

/*
 * Renamed from velox.indicators.sionchart.E
 */
public class e_0
implements TimeListener,
TradeDataListener {
    long a;
    public final List<g_0> b = Collections.synchronizedList(new ArrayList());
    g_0 c = null;
    private boolean e = false;
    private final TreeMap<Integer, Map<String, n>> f = new TreeMap();
    private final Map<String, l> g = new HashMap<String, l>();
    private final m h;
    private final e i;
    final boolean d;

    e_0(m m2, boolean bl) {
        this.h = m2;
        this.d = bl;
        this.i = m2.c();
    }

    e_0(m m2) {
        this(m2, false);
    }

    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        if (this.e && n2 > 0) {
            l l2 = this.g.get(tradeInfo.aggressorOrderId);
            if (l2 == null) {
                l2 = new l(tradeInfo.aggressorOrderId, tradeInfo.isBidAggressor, 0, 0, 0L, 0, this.f);
                this.f.clear();
                this.g.put(tradeInfo.aggressorOrderId, l2);
            }
            j j2 = new j(OrderEventType.STOP, this.a, (int)d2, n2, l2);
            this.c.a(j2, tradeInfo.isBidAggressor);
            this.h.a(j2);
            if (this.d) {
                Log.info((String)("Stop id: " + tradeInfo.aggressorOrderId + ", passive id: " + tradeInfo.passiveOrderId));
            }
        }
    }

    public void onTimestamp(long l2) {
        this.a = l2;
    }

    public void a(d d2) {
        switch (d2) {
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
                throw new RuntimeException("Unknown stop chain state: " + d2);
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
            if ((this.i.stopsAlertEnabled || this.i.stopsPopupEnabled || this.h.v.b()) && this.c.b >= this.i.stopsAlertThreshold && (!this.i.showOnlyStopsTBPLAlerts || this.c.b()) && this.a == this.h.f.getProvider().getCurrentTime()) {
                this.h.i.a(this.c.a(), this.c.b, this.c.c, true);
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
            object = "Inconsistent MBO data for " + this.h.h + ". Stops and icebergs detection may be inaccurate.";
            Log.warn((String)(t.a(this.a) + " (" + this.a + ") " + (String)object));
            this.h.a((String)object);
        }
    }
}

