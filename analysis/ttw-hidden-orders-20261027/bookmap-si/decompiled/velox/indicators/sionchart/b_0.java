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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import velox.api.layer1.common.Log;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.simplified.MarketByOrderDepthDataListener;
import velox.api.layer1.simplified.TimeListener;
import velox.api.layer1.simplified.TradeDataListener;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.a.n;
import velox.indicators.sionchart.c_0;
import velox.indicators.sionchart.d;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.k;
import velox.indicators.sionchart.l;

/*
 * Renamed from velox.indicators.sionchart.B
 */
public class b_0
implements MarketByOrderDepthDataListener,
TimeListener,
TradeDataListener {
    long a;
    final List<c_0> b = new ArrayList<c_0>();
    c_0 c = null;
    private boolean e = false;
    private final TreeMap<Integer, Map<String, n>> f = new TreeMap();
    private final SitIndicator g;
    private final d h;
    final boolean d;

    b_0(SitIndicator sitIndicator, boolean bl) {
        this.g = sitIndicator;
        this.d = bl;
        this.h = sitIndicator.c();
    }

    public void send(String string, boolean bl, int n2, int n3) {
    }

    public void replace(String string, int n2, int n3) {
    }

    public void cancel(String string) {
    }

    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        if (this.e && n2 > 0) {
            l l2 = new l("", tradeInfo.isBidAggressor, 0, 0, 0L, this.f);
            this.c.a(new j(k.STOP, this.a, (int)d2, n2, l2), tradeInfo.isBidAggressor);
            if (this.d) {
                Log.info((String)("Stop id: " + tradeInfo.aggressorOrderId + ", passive id: " + tradeInfo.passiveOrderId));
            }
        }
    }

    public void onTimestamp(long l2) {
        this.a = l2;
    }

    public void a(boolean bl) {
        if (bl) {
            if (!this.e) {
                this.a();
            }
        } else {
            this.b();
        }
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private void a() {
        this.c = new c_0();
        List<c_0> list = this.b;
        synchronized (list) {
            this.b.add(this.c);
        }
        this.e = true;
    }

    private void b() {
        if (this.e) {
            this.e = false;
            this.c.a();
            if (this.h.stopsAlertEnabled && this.c.b >= this.h.stopsAlertThreshold && this.a == this.g.g.getProvider().getCurrentTime()) {
                this.g.j.b(this.c.b(), this.c.b, this.c.c, true);
            }
        }
    }
}

