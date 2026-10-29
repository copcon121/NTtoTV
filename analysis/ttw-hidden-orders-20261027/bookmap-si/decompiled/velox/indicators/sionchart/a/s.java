/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.TradeInfo
 *  velox.api.layer1.simplified.MarketByOrderDepthDataListener
 *  velox.api.layer1.simplified.TimeListener
 *  velox.api.layer1.simplified.TradeDataListener
 */
package velox.indicators.sionchart.a;

import java.util.ArrayList;
import java.util.List;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.simplified.MarketByOrderDepthDataListener;
import velox.api.layer1.simplified.TimeListener;
import velox.api.layer1.simplified.TradeDataListener;

public class s
implements MarketByOrderDepthDataListener,
TimeListener,
TradeDataListener {
    public final List<TimeListener> a = new ArrayList<TimeListener>();
    public final List<MarketByOrderDepthDataListener> b = new ArrayList<MarketByOrderDepthDataListener>();
    public final List<TradeDataListener> c = new ArrayList<TradeDataListener>();

    public void send(String string, boolean bl, int n2, int n3) {
        this.b.forEach(marketByOrderDepthDataListener -> marketByOrderDepthDataListener.send(string, bl, n2, n3));
    }

    public void replace(String string, int n2, int n3) {
        this.b.forEach(marketByOrderDepthDataListener -> marketByOrderDepthDataListener.replace(string, n2, n3));
    }

    public void cancel(String string) {
        this.b.forEach(marketByOrderDepthDataListener -> marketByOrderDepthDataListener.cancel(string));
    }

    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        this.c.forEach(tradeDataListener -> tradeDataListener.onTrade(d2, n2, tradeInfo));
    }

    public void onTimestamp(long l2) {
        this.a.forEach(timeListener -> timeListener.onTimestamp(l2));
    }
}

