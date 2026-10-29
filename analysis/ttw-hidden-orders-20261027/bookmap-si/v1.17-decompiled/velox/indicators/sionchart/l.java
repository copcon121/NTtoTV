/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart;

import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.a.n;
import velox.indicators.sionchart.c;
import velox.indicators.sionchart.k;

public class l
extends n {
    private int p = 0;
    private double q = 0.0;
    public transient Supplier<Double> a = () -> this.q / (double)this.p;
    public transient Supplier<Integer> b = () -> this.p;
    public boolean c = false;
    List<c> d = new LinkedList<c>();

    public l(String string, boolean bl, int n2, int n3, long l2, Map<Integer, Map<String, n>> map) {
        super(string, bl, n2, n3, map);
    }

    public l(l l2, long l3, Map<Integer, Map<String, n>> map, List<k> list, SitIndicator sitIndicator) {
        super(l2.f, l2.g, l2.h, l2.i, map, list, sitIndicator);
        this.p = l2.p;
        this.q = l2.q;
        this.j = l2.j;
        k k2 = new k(OrderEventType.DETECTION, l3, this.h, this.p, this);
        this.l.add(k2);
        list.add(k2);
        sitIndicator.a(k2);
    }

    public int a() {
        return this.p;
    }

    public void a(long l2, int n2, int n3) {
        if (n2 != this.h) {
            this.a(n2, 0, l2);
        }
        this.p += n3;
        this.q += (double)(n2 * n3);
        this.j -= n3;
        k k2 = new k(OrderEventType.TRADE, l2, n2, n3, this);
        this.l.add(k2);
        if (this.n != null) {
            this.n.add(k2);
            this.e.a(k2);
        }
    }
}

