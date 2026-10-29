/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.TradeInfo
 */
package velox.indicators.sionchart;

import velox.api.layer1.data.TradeInfo;
import velox.indicators.sionchart.b.n;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.g;
import velox.indicators.sionchart.l;
import velox.indicators.sionchart.m;

public class h
extends g {
    protected final m a;
    protected final e b;

    h(m m2) {
        this.a = m2;
        this.b = m2.c();
    }

    @Override
    public void send(String string, boolean bl, int n2, int n3) {
    }

    @Override
    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        super.onTrade(d2, n2, tradeInfo);
        if (tradeInfo.aggressorOrderId != null) {
            this.b((l)this.e.get(tradeInfo.aggressorOrderId));
        }
        if (tradeInfo.passiveOrderId != null) {
            this.b((l)this.e.get(tradeInfo.passiveOrderId));
        }
    }

    public void a(l l2) {
        l l3 = new l(l2, this.h, l2.f ? this.d : this.c, l2.f ? this.g : this.f, this.a);
        this.e.put(l2.e, l3);
        this.b(l3);
    }

    @Override
    public void replace(String string, int n2, int n3) {
        n n4 = (n)this.e.get(string);
        if (n4 != null) {
            n4.a(n2, n3, this.h);
        }
    }

    @Override
    public void cancel(String string) {
        n n2 = (n)this.e.get(string);
        if (n2 != null) {
            n2.a(this.h);
        }
    }

    public void b(l l2) {
        if (l2 != null && !l2.c && (this.b.icebergsAlertEnabled || this.b.icebergsPopupEnabled || this.a.v.a()) && l2.a() >= this.b.icebergsAlertThreshold) {
            l2.c = true;
            if (this.h == this.a.f.getProvider().getCurrentTime()) {
                this.a.i.a(l2.g, l2.a(), l2.f, false);
            }
        }
    }
}

