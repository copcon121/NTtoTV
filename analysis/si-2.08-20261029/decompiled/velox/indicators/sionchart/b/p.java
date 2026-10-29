/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.simplified.MarketByOrderDepthDataListener
 */
package velox.indicators.sionchart.b;

import java.util.HashSet;
import velox.api.layer1.simplified.MarketByOrderDepthDataListener;
import velox.indicators.sionchart.b.c;

public class p {
    public static MarketByOrderDepthDataListener a(MarketByOrderDepthDataListener marketByOrderDepthDataListener) {
        return p.a(marketByOrderDepthDataListener, () -> {});
    }

    public static MarketByOrderDepthDataListener a(MarketByOrderDepthDataListener marketByOrderDepthDataListener, Runnable runnable) {
        HashSet hashSet = new HashSet();
        c.c<Boolean, Runnable> c2 = (bl, runnable2) -> (bl != false ? runnable2 : runnable).run();
        return c.a((String string, Boolean bl, Integer n2, Integer n3) -> c2.accept(hashSet.add(string), () -> marketByOrderDepthDataListener.send(string, bl.booleanValue(), n2.intValue(), n3.intValue())), (String string, Integer n2, Integer n3) -> c2.accept(hashSet.contains(string), () -> marketByOrderDepthDataListener.replace(string, n2.intValue(), n3.intValue())), (String string) -> c2.accept(hashSet.remove(string), () -> marketByOrderDepthDataListener.cancel(string)));
    }
}

