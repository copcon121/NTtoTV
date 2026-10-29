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

public class g
extends a
implements TimeListener {
    long c;
    private final String d;

    public g() {
        this.d = "";
    }

    public g(String string) {
        this.d = string;
    }

    @Override
    public void send(String string, boolean bl, int n2, int n3) {
        super.send(string, bl, n2, n3);
        Log.info((String)(t.a(this.c) + " " + this.d + " Send order id: " + string + (bl ? " buy" : " sell") + " price: " + n2 + " size:" + n3));
    }

    @Override
    public void replace(String string, int n2, int n3) {
        super.replace(string, n2, n3);
        Log.info((String)(t.a(this.c) + " " + this.d + " Replace order id: " + string + " price: " + n2 + " size:" + n3));
    }

    @Override
    public void cancel(String string) {
        super.cancel(string);
        Log.info((String)(t.a(this.c) + " " + this.d + " Cancel order id: " + string));
    }

    @Override
    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        super.onTrade(d2, n2, tradeInfo);
        if (n2 > 0) {
            Log.info((String)(t.a(this.c) + " " + this.d + " Trade " + (tradeInfo.isBidAggressor ? "Buy" : "Sell") + " aggressor: " + tradeInfo.aggressorOrderId + " passive: " + tradeInfo.passiveOrderId + " price: " + d2 + " size:" + n2));
        }
    }

    public void onTimestamp(long l2) {
        this.c = l2;
    }

    @Override
    public void onDepth(boolean bl, int n2, int n3) {
        super.onDepth(bl, n2, n3);
        Log.info((String)(t.a(this.c) + " " + this.d + " onDepth " + (bl ? "Bid" : "Ask") + " price = " + n2 + " size = " + n3));
    }
}

