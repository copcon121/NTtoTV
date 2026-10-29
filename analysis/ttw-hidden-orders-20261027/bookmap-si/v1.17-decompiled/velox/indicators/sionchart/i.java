/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.TradeInfo
 */
package velox.indicators.sionchart;

import velox.api.layer1.data.TradeInfo;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.a.n;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.h;
import velox.indicators.sionchart.l;

public class i
extends h {
    private final SitIndicator g;
    private final e h;

    i(SitIndicator sitIndicator) {
        this.g = sitIndicator;
        this.h = sitIndicator.e();
    }

    @Override
    public void send(String string, boolean bl, int n2, int n3) {
    }

    @Override
    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        super.onTrade(d2, n2, tradeInfo);
        if (tradeInfo.aggressorOrderId != null) {
            this.b((l)this.c.get(tradeInfo.aggressorOrderId));
        }
        if (tradeInfo.passiveOrderId != null) {
            this.b((l)this.c.get(tradeInfo.passiveOrderId));
        }
    }

    public void a(l l2) {
        l l3 = new l(l2, this.f, l2.g ? this.b : this.a, l2.g ? this.e : this.d, this.g);
        this.c.put(l2.f, l3);
        this.b(l3);
    }

    @Override
    public void replace(String string, int n2, int n3) {
        n n4 = (n)this.c.get(string);
        if (n4 != null) {
            n4.a(n2, n3, this.f);
        }
    }

    @Override
    public void cancel(String string) {
        n n2 = (n)this.c.get(string);
        if (n2 != null) {
            n2.a(this.f);
        }
    }

    public void b(l l2) {
        if (l2 != null && !l2.c && this.h.icebergsAlertEnabled && l2.a() >= this.h.icebergsAlertThreshold) {
            l2.c = true;
            if (this.f == this.g.h.getProvider().getCurrentTime()) {
                this.g.k.b(l2.h, l2.a(), l2.g, false);
            }
        }
    }
}

