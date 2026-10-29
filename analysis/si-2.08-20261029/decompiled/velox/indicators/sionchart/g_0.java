/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart;

import java.util.ArrayList;
import java.util.List;
import velox.indicators.sionchart.j;

/*
 * Renamed from velox.indicators.sionchart.G
 */
public class g_0 {
    public final List<j> a = new ArrayList<j>();
    int b = 0;
    boolean c;

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    public void a(j j2, boolean bl) {
        this.c = bl;
        List<j> list = this.a;
        synchronized (list) {
            this.a.add(j2);
        }
        this.b += j2.e;
        j2.f = this.b;
    }

    public double a() {
        if (this.a.size() == 1) {
            return this.a.get((int)0).d;
        }
        if (this.a.isEmpty()) {
            return 0.0;
        }
        double d2 = 0.0;
        double d3 = 0.0;
        for (j j2 : this.a) {
            d2 += (double)(j2.d * j2.e);
            d3 += (double)j2.e;
        }
        return d2 / d3;
    }

    public boolean b() {
        return this.a.size() > 1 && this.a.get((int)0).d != this.a.get((int)(this.a.size() - 1)).d;
    }
}

