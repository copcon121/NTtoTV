/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart;

import java.util.LinkedList;
import java.util.List;
import java.util.ListIterator;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.c;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.l;

public class a {
    public final String a;
    private final int g;
    public final boolean b;
    public final boolean c;
    public final int d;
    public final List<j> e;
    public final List<c> f = new LinkedList<c>();

    public a(l l2) {
        this.a = l2.e;
        this.g = l2.a();
        this.b = l2.j;
        this.c = l2.f;
        this.d = l2.g;
        this.e = l2.k;
    }

    public int a() {
        return this.g;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    public int b() {
        if (!this.e.isEmpty()) {
            List<j> list = this.e;
            synchronized (list) {
                ListIterator<j> listIterator = this.e.listIterator(this.e.size());
                while (listIterator.hasPrevious()) {
                    j j2 = listIterator.previous();
                    if (j2.b == OrderEventType.MOVEMENT) continue;
                    return j2.e;
                }
            }
        }
        return 0;
    }
}

