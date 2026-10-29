/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart;

import java.util.List;
import velox.indicators.sionchart.c;
import velox.indicators.sionchart.g_0;
import velox.indicators.sionchart.j;

public class b {
    public final List<j> a;
    public final int b;
    public final boolean c;
    public c d;
    public boolean e;

    b(g_0 g_02) {
        this.c = g_02.c;
        this.b = g_02.b;
        this.a = g_02.a;
    }

    public boolean a() {
        return this.a.size() > 1 && this.a.get((int)0).d != this.a.get((int)(this.a.size() - 1)).d;
    }
}

