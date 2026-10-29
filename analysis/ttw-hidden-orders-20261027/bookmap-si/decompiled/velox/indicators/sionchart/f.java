/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.common.Log
 *  velox.api.layer1.data.TradeInfo
 *  velox.api.layer1.simplified.TimeListener
 */
package velox.indicators.sionchart;

import a.a.b.a.a.a;
import velox.api.layer1.common.Log;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.simplified.TimeListener;
import velox.indicators.sionchart.a.t;

public class f
extends a
implements TimeListener {
    long c;

    @Override
    public void send(String string, boolean bl, int n2, int n3) {
        super.send(string, bl, n2, n3);
        Log.info((String)(t.a(this.c) + " Send order id: " + string + (bl ? " buy" : " sell") + " price: " + n2 + " size:" + n3));
    }

    @Override
    public void replace(String string, int n2, int n3) {
        super.replace(string, n2, n3);
        Log.info((String)(t.a(this.c) + " Replace order id: " + string + " price: " + n2 + " size:" + n3));
    }

    @Override
    public void cancel(String string) {
        super.cancel(string);
        Log.info((String)(t.a(this.c) + " Cancel order id: " + string));
    }

    @Override
    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        super.onTrade(d2, n2, tradeInfo);
        if (n2 > 0) {
            Log.info((String)(t.a(this.c) + " Trade aggressor: " + tradeInfo.aggressorOrderId + " passive: " + tradeInfo.passiveOrderId + " price: " + d2 + " size:" + n2));
        }
    }

    public void onTimestamp(long l2) {
        this.c = l2;
    }
}

