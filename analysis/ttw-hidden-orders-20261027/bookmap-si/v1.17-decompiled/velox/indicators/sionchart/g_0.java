/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart;

import java.util.ArrayList;
import java.util.List;
import velox.indicators.sionchart.c;
import velox.indicators.sionchart.k;

/*
 * Renamed from velox.indicators.sionchart.G
 */
public class g_0 {
    final List<k> a = new ArrayList<k>();
    int b = 0;
    boolean c;
    boolean d;
    c e;

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    public void a(k k2, boolean bl) {
        this.c = bl;
        List<k> list = this.a;
        synchronized (list) {
            this.a.add(k2);
        }
        this.b += k2.e;
        k2.f = this.b;
    }

    public void a() {
        if (this.a.size() > 0) {
            this.a.get((int)0).f = this.b;
            this.a.get((int)(this.a.size() - 1)).f = this.b;
        }
    }

    public double b() {
        if (this.a.size() == 1) {
            return this.a.get((int)0).d;
        }
        if (this.a.size() == 0) {
            return 0.0;
        }
        double d2 = 0.0;
        double d3 = 0.0;
        for (k k2 : this.a) {
            d2 += (double)(k2.d * k2.e);
            d3 += (double)k2.e;
        }
        return d2 / d3;
    }

    boolean c() {
        return this.a.size() > 1 && this.a.get((int)0).d != this.a.get((int)(this.a.size() - 1)).d;
    }
}

