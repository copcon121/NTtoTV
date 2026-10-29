/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart;

import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.b.n;
import velox.indicators.sionchart.l;

public class j {
    public final l a;
    public final OrderEventType b;
    public final long c;
    public final int d;
    public int e = 0;
    public int f;

    public j(OrderEventType orderEventType, long l2, int n2, n n3) {
        this.b = orderEventType;
        this.c = l2;
        this.d = n2;
        this.a = (l)n3;
        this.f = this.a.a();
    }

    public j(OrderEventType orderEventType, long l2, int n2, int n3, n n4) {
        this(orderEventType, l2, n2, n4);
        this.e = n3;
    }
}

