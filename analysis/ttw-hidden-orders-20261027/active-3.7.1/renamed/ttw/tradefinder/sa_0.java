/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.h;
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.Sa
 */
public class sa_0
extends wa_2<h> {
    public int A;
    public int C;
    public boolean M;
    public boolean c;

    public sa_0() {
        sa_0 a2;
        sa_0 sa_02 = a2;
        sa_0 sa_03 = a2;
        super(h.class);
        sa_03.c = false;
        sa_03.M = false;
        sa_02.C = 5;
        sa_02.A = 5;
    }

    @Override
    public void E(h a2) {
        sa_0 a3;
        sa_0 sa_02 = a3;
        h h2 = a2;
        sa_0 sa_03 = a3;
        sa_03.b = a2.IsDefault;
        sa_03.c = a2.a;
        a3.M = h2.b;
        sa_02.C = h2.c;
        sa_02.A = a2.d;
    }

    @Override
    public h E() {
        sa_0 a2;
        h h2 = new h();
        new h().IsDefault = a2.b;
        sa_0 sa_02 = a2;
        h2.a = a2.c;
        h2.b = sa_02.M;
        h2.c = sa_02.C;
        h2.d = a2.A;
        return h2;
    }
}

