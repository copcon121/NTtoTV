/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ed_0;

public abstract class Oe {
    public int k;
    public int B;
    public long K;
    public long E;
    public int j;
    public int a;
    public int h;
    public long H;
    public final String D;
    public int A;
    public final ed_0 C;
    public final boolean M;
    public long b;
    public long c;

    public /* synthetic */ double a() {
        Oe a2;
        return (double)(a2.E - a2.H) / 1000000.0;
    }

    public /* synthetic */ boolean j() {
        Oe a2;
        return a2.b != 0L;
    }

    public /* synthetic */ int E() {
        Oe a2;
        if (a2.c == 0L) {
            return 0;
        }
        return a2.a;
    }

    public /* synthetic */ double j() {
        Oe a2;
        return (double)(a2.b - a2.K) / 1000000.0;
    }

    public /* synthetic */ double E() {
        Oe a2;
        return (double)(a2.b - a2.E) / 1000000.0;
    }

    public /* synthetic */ Oe(String a2, boolean a3, ed_0 a4) {
        Oe a5;
        Oe oe = a5;
        Oe oe2 = a5;
        Oe oe3 = a5;
        Oe oe4 = a5;
        Oe oe5 = a5;
        Oe oe6 = a5;
        Oe oe7 = a5;
        oe7.h = 0;
        oe7.A = 0;
        oe6.k = 0;
        oe6.a = 0;
        oe5.B = 0;
        oe5.j = 0;
        oe4.E = 0L;
        oe4.H = 0L;
        oe3.c = 0L;
        oe3.K = 0L;
        oe2.b = 0L;
        oe2.D = a2;
        oe.M = a3;
        oe.C = a4;
    }

    public /* synthetic */ int E(long a2) {
        Oe a3;
        return a3.C.a(a2);
    }

    public /* synthetic */ boolean E() {
        Oe a2;
        return a2.c != 0L;
    }
}

