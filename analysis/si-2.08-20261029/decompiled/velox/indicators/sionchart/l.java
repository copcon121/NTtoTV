/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart;

import java.util.List;
import java.util.Map;
import java.util.function.DoubleSupplier;
import java.util.function.IntSupplier;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.b.n;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.m;

public class l
extends n {
    private int o;
    private double p = 0.0;
    public DoubleSupplier a = () -> {
        double d2 = this.p / (double)this.o;
        return Double.isNaN(d2) ? (double)this.g : d2;
    };
    public IntSupplier b = () -> this.o;
    public boolean c = false;

    public l(String string, boolean bl, int n2, int n3, long l2, int n4, Map<Integer, Map<String, n>> map) {
        super(string, bl, n2, n3, map);
        this.o = n4;
    }

    public l(l l2, long l3, Map<Integer, Map<String, n>> map, List<j> list, m m2) {
        super(l2.e, l2.f, l2.g, l2.h, map, list, m2);
        this.o = l2.o;
        this.p = l2.p;
        this.i = l2.i;
        j j2 = new j(OrderEventType.DETECTION, l3, this.g, this.o, this);
        this.k.add(j2);
        list.add(j2);
        m2.a(j2);
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
        j j2 = new j(OrderEventType.TRADE, l2, n2, n3, this);
        this.k.add(j2);
        if (this.m != null) {
            this.m.add(j2);
            this.d.a(j2);
        }
    }
}

