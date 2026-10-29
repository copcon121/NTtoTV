/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart;

import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import velox.indicators.sionchart.a.n;
import velox.indicators.sionchart.b;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.k;

public class l
extends n {
    private int o = 0;
    private double p = 0.0;
    public transient Supplier<Double> a = () -> this.p / (double)this.o;
    public transient Supplier<Integer> b = () -> this.o;
    public boolean c = false;
    List<b> d = new LinkedList<b>();

    public l(String string, boolean bl, int n2, int n3, long l2, Map<Integer, Map<String, n>> map) {
        super(string, bl, n2, n3, map);
    }

    public l(l l2, long l3, Map<Integer, Map<String, n>> map, List<j> list) {
        super(l2.e, l2.f, l2.g, l2.h, map, list);
        this.o = l2.o;
        this.p = l2.p;
        this.i = l2.i;
        j j2 = new j(velox.indicators.sionchart.k.DETECTED, l3, this.g, this.o, this);
        this.k.add(j2);
        list.add(j2);
    }

    public int a() {
        return this.o;
    }

    public void a(long l2, int n2, int n3) {
        if (n2 != this.g) {
            this.a(n2, 0, l2);
        }
        this.o += n3;
        this.p += (double)(n2 * n3);
        this.i -= n3;
        j j2 = new j(velox.indicators.sionchart.k.TRADE, l2, n2, n3, this);
        this.k.add(j2);
        if (this.m != null) {
            this.m.add(j2);
        }
    }
}

