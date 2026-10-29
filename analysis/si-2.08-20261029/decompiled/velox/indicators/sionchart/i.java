/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.common.Log
 *  velox.api.layer1.data.TradeInfo
 */
package velox.indicators.sionchart;

import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import velox.api.layer1.common.Log;
import velox.api.layer1.data.TradeInfo;
import velox.indicators.sionchart.h;
import velox.indicators.sionchart.l;
import velox.indicators.sionchart.m;

public class i
extends h {
    public i(m m2) {
        super(m2);
    }

    @Override
    public void a(l l2) {
        this.a(l2, () -> "new iceberg detected");
        super.a(l2);
    }

    @Override
    public void replace(String string, int n2, int n3) {
        this.a((l)this.e.get(string), () -> String.format("replace: %d at %d", n3, n2));
        super.replace(string, n2, n3);
    }

    @Override
    public void cancel(String string) {
        this.a((l)this.e.get(string), () -> "cancel");
        super.cancel(string);
    }

    @Override
    public void onTrade(double d2, int n2, TradeInfo tradeInfo) {
        super.onTrade(d2, n2, tradeInfo);
        if (tradeInfo.aggressorOrderId != null) {
            this.a((l)this.e.get(tradeInfo.aggressorOrderId), () -> String.format("a trade: %d at %g", n2, d2));
        }
        this.a(n2 == 0 || tradeInfo.passiveOrderId == null ? null : (l)this.e.get(tradeInfo.passiveOrderId), () -> String.format("trade: %d at %g", n2, d2));
    }

    private void a(l l2, Supplier<String> supplier) {
        if (l2 != null) {
            Object object = supplier.get();
            object = (String)object + IntStream.range(((String)object).length(), 21).mapToObj(n2 -> " ").collect(Collectors.joining());
            Log.info((String)String.format("%s|order %s: %s %d at %d, cumulative trade: %d at %g|", object, l2.e, l2.f ? "Buy" : "Sell", l2.h, l2.g, l2.b.getAsInt(), l2.a.getAsDouble()));
        }
    }
}

