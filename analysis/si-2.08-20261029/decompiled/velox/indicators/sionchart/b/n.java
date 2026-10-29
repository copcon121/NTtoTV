/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.b;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.m;

public class n {
    protected m d;
    public final String e;
    public final boolean f;
    public int g;
    public int h;
    public int i;
    public boolean j = true;
    public List<j> k = Collections.synchronizedList(new ArrayList());
    public final Map<Integer, Map<String, n>> l;
    public List<j> m;
    public Map<String, n> n;

    public n(String string, boolean bl, int n2, int n3, Map<Integer, Map<String, n>> map) {
        this.e = string;
        this.f = bl;
        this.h = n3;
        this.i = n3;
        this.l = map;
        this.a(n2);
    }

    public n(String string, boolean bl, int n2, int n3, Map<Integer, Map<String, n>> map, List<j> list, m m2) {
        this(string, bl, n2, n3, map);
        this.m = list;
        this.d = m2;
        this.a(n2);
    }

    public void a(int n2, int n3, long l2) {
        if (n2 != this.g) {
            this.a();
            this.a(n2);
            j j2 = new j(OrderEventType.MOVEMENT, l2, n2, this);
            this.k.add(j2);
            if (this.m != null) {
                this.m.add(j2);
                this.d.a(j2);
            }
        }
        if (n3 != 0) {
            this.h = n3;
            this.i = n3;
        }
    }

    public void a(long l2) {
        this.a();
        this.j = false;
        j j2 = new j(this.i <= 0 ? OrderEventType.EXECUTION : OrderEventType.CANCELLATION, l2, this.g, this);
        this.k.add(j2);
        if (this.m != null) {
            this.m.add(j2);
            this.d.a(j2);
        }
    }

    private void a(int n3) {
        this.g = n3;
        this.n = this.l.computeIfAbsent(n3, n2 -> new LinkedHashMap());
        this.n.put(this.e, this);
    }

    private void a() {
        this.n.remove(this.e);
        if (this.n.isEmpty()) {
            this.l.remove(this.g);
        }
    }
}

