/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.TradeInfo
 *  velox.api.layer1.simplified.TradeDataListener
 */
package velox.indicators.sionchart;

import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.simplified.TradeDataListener;
import velox.indicators.sionchart.a.o;
import velox.indicators.sionchart.l;

public class h
extends o
implements TradeDataListener {
    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        if (n2 > 0) {
            this.a(tradeInfo.aggressorOrderId, (int)d2, n2);
            this.a(tradeInfo.passiveOrderId, (int)d2, n2);
        }
    }

    protected void a(String string, int n2, int n3) {
        l l2;
        if (string != null && (l2 = (l)this.c.get(string)) != null) {
            l2.a(this.f, n2, n3);
        }
    }
}

