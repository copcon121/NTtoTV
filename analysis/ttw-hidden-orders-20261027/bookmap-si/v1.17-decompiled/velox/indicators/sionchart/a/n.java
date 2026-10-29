/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.a;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.ListIterator;
import java.util.Map;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.k;

public class n {
    protected transient SitIndicator e;
    public final String f;
    public final boolean g;
    public int h;
    public int i;
    public int j;
    public boolean k = true;
    public final List<k> l = Collections.synchronizedList(new ArrayList());
    public final transient Map<Integer, Map<String, n>> m;
    public transient List<k> n;
    public transient Map<String, n> o;

    public n(String string, boolean bl, int n2, int n3, Map<Integer, Map<String, n>> map) {
        this.f = string;
        this.g = bl;
        this.i = n3;
        this.j = n3;
        this.m = map;
        this.a(n2);
    }

    public n(String string, boolean bl, int n2, int n3, Map<Integer, Map<String, n>> map, List<k> list, SitIndicator sitIndicator) {
        this(string, bl, n2, n3, map);
        this.n = list;
        this.e = sitIndicator;
        this.a(n2);
    }

    public void a(int n2, int n3, long l2) {
        if (n2 != this.h) {
            this.a();
            this.a(n2);
            k k2 = new k(OrderEventType.MOVEMENT, l2, n2, this);
            this.l.add(k2);
            if (this.n != null) {
                this.n.add(k2);
                this.e.a(k2);
            }
        }
        if (n3 != 0) {
            this.i = n3;
            this.j = n3;
        }
    }

    public void a(long l2) {
        this.a();
        this.k = false;
        k k2 = new k(this.j <= 0 ? OrderEventType.EXECUTION : OrderEventType.CANCELLATION, l2, this.h, this);
        this.l.add(k2);
        if (this.n != null) {
            this.n.add(k2);
            this.e.a(k2);
        }
    }

    private void a(int n3) {
        this.h = n3;
        this.o = this.m.computeIfAbsent(n3, n2 -> new LinkedHashMap());
        this.o.put(this.f, this);
    }

    private void a() {
        this.o.remove(this.f);
        if (this.o.isEmpty()) {
            this.m.remove(this.h);
        }
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    public int b() {
        if (this.l.size() > 0) {
            List<k> list = this.l;
            synchronized (list) {
                ListIterator<k> listIterator = this.l.listIterator(this.l.size());
                while (listIterator.hasPrevious()) {
                    k k2 = listIterator.previous();
                    if (k2.b == OrderEventType.MOVEMENT) continue;
                    return k2.e;
                }
            }
        }
        return 0;
    }
}

