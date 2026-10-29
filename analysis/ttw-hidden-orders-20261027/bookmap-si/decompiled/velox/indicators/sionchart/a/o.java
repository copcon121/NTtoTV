/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.simplified.MarketByOrderDepthDataListener
 *  velox.api.layer1.simplified.TimeListener
 */
package velox.indicators.sionchart.a;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import velox.api.layer1.simplified.MarketByOrderDepthDataListener;
import velox.api.layer1.simplified.TimeListener;
import velox.indicators.sionchart.a.n;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.l;

public class o
implements MarketByOrderDepthDataListener,
TimeListener {
    public final TreeMap<Integer, Map<String, n>> a = new TreeMap();
    public final TreeMap<Integer, Map<String, n>> b = new TreeMap(Collections.reverseOrder());
    public final Map<String, l> c = new ConcurrentHashMap<String, l>();
    public final List<j> d = Collections.synchronizedList(new ArrayList());
    public final List<j> e = Collections.synchronizedList(new ArrayList());
    public long f;

    public void send(String string, boolean bl, int n2, int n3) {
        this.c.put(string, new l(string, bl, n2, n3, this.f, bl ? this.b : this.a));
    }

    public void replace(String string, int n2, int n3) {
        this.c.get(string).a(n2, n3, this.f);
    }

    public void cancel(String string) {
        this.c.remove(string).a(this.f);
    }

    public void onTimestamp(long l2) {
        this.f = l2;
    }
}

