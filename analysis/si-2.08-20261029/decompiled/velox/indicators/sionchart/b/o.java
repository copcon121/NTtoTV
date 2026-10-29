/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.simplified.MarketByOrderDepthDataListener
 *  velox.api.layer1.simplified.TimeListener
 */
package velox.indicators.sionchart.b;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import velox.api.layer1.simplified.MarketByOrderDepthDataListener;
import velox.api.layer1.simplified.TimeListener;
import velox.indicators.sionchart.b.n;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.l;

public class o
implements MarketByOrderDepthDataListener,
TimeListener {
    public final SortedMap<Integer, Map<String, n>> c = new TreeMap<Integer, Map<String, n>>();
    public final SortedMap<Integer, Map<String, n>> d = new TreeMap(Collections.reverseOrder());
    public final Map<String, l> e = new ConcurrentHashMap<String, l>();
    public final List<j> f = Collections.synchronizedList(new ArrayList());
    public final List<j> g = Collections.synchronizedList(new ArrayList());
    public long h;

    public void send(String string, boolean bl, int n2, int n3) {
        this.e.put(string, new l(string, bl, n2, n3, this.h, 0, bl ? this.d : this.c));
    }

    public void replace(String string, int n2, int n3) {
        this.e.get(string).a(n2, n3, this.h);
    }

    public void cancel(String string) {
        this.e.remove(string).a(this.h);
    }

    public void onTimestamp(long l2) {
        this.h = l2;
    }
}

