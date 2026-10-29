/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.Oe;
import ttw.tradefinder.dg_0;
import ttw.tradefinder.ed_0;
import ttw.tradefinder.gd_2;
import ttw.tradefinder.lg_0;

/*
 * Renamed from ttw.tradefinder.jF
 */
public class jf_1
extends Oe {
    public static String H = gd_2.E("}>}4");
    public int D;
    public int C;
    public dg_0 M;
    private int b;
    public int c;

    public /* synthetic */ void E(long a2, int a3, int a4) {
        jf_1 a5;
        jf_1 jf_12 = a5;
        int n2 = jf_12.h;
        int n3 = jf_12.D;
        jf_12.c = a4;
        jf_12.C = a4;
        jf_12.h = a3;
        jf_12.D = jf_12.a;
        jf_12.j = Math.max(jf_12.j, a3 - n2);
        int n4 = jf_12.C;
        synchronized (n4) {
            a5.C.E(a2, a4, 0);
        }
        if (a5.c == 0L) {
            if (a3 <= n2) {
                return;
            }
            if (a5.a == n3) {
                return;
            }
            a5.c = (int)a2;
        }
    }

    public /* synthetic */ jf_1(dg_0 a2, int a3, int a4, boolean a5, long a6) {
        jf_1 a7;
        jf_1 jf_12 = a7;
        long l2 = a6;
        jf_1 jf_13 = a7;
        jf_1 jf_14 = a7;
        jf_1 jf_15 = a7;
        jf_1 jf_16 = a7;
        jf_1 jf_17 = a7;
        super(H, a5, new ed_0(3));
        jf_17.c = 0;
        jf_17.C = 0;
        jf_16.D = 0;
        jf_16.b = 0;
        jf_15.M = a2;
        jf_15.a = a3;
        jf_14.A = a4;
        jf_14.c = a4;
        a7.E = a6;
        jf_13.c = (int)a7.E;
        jf_13.H = (String)a6;
        a7.K = l2 - 1L;
        a7.b = (int)(l2 + 1L);
        jf_12.k = a4;
        a7.C.E(a6, a4, -1);
        jf_12.C.E(a6, a4, a3);
        jf_12.C.E(a6, a4, -1);
    }

    public /* synthetic */ jf_1(dg_0 a2, lg_0 a3, int a4, int a5, boolean a6, long a7) {
        jf_1 a8;
        jf_1 jf_12 = a8;
        lg_0 lg_02 = a3;
        lg_0 lg_03 = a3;
        jf_1 jf_13 = a8;
        jf_1 jf_14 = a8;
        jf_1 jf_15 = a8;
        jf_1 jf_16 = a8;
        super(a3.M, a6, new ed_0(5, 100));
        a8.c = 0;
        jf_16.C = 0;
        jf_16.D = 0;
        jf_15.b = 0;
        jf_15.M = a2;
        jf_14.K = a7;
        jf_14.h = a4;
        jf_13.C = a8.c = a5;
        jf_13.H = (String)a3.h;
        a8.A = lg_03.c;
        a8.E = lg_03.h;
        a8.D = a8.a = lg_02.j();
        a8.B = a8.a;
        a8.k = lg_02.E();
        jf_12.j = a4;
        a8.b = a8.a;
        jf_12.C.E(a7, a8.k, -1);
        jf_12.C.E(a7, a8.k, a3.j());
        jf_12.C.E(a7, a5, 0);
    }

    public /* synthetic */ jf_1(dg_0 a2, String a3, int a4, int a5, boolean a6, long a7) {
        jf_1 a8;
        jf_1 jf_12 = a8;
        jf_1 jf_13 = a8;
        jf_1 jf_14 = a8;
        super(a3, a6, new ed_0(5, 100));
        a8.c = 0;
        jf_14.C = 0;
        jf_14.D = 0;
        jf_13.b = 0;
        jf_13.M = a2;
        jf_12.K = a7;
        jf_12.h = a4;
        a8.C = a8.c = a5;
        a8.k = a5;
        a8.C.E(a7, a5, -1);
    }

    public /* synthetic */ int E(long a2, int a3, int a4, boolean a52) {
        jf_1 a6;
        a6.a += a3;
        if (a52) {
            a6.B += a3;
        }
        jf_1 jf_12 = a6;
        jf_12.E = a2;
        jf_12.A = a4;
        if (a6.H == 0L) {
            a6.H = (String)a2;
        }
        a6.h = Math.max(0, a6.h - a3);
        int a52 = a6.C;
        synchronized (a52) {
            if (a6.C != a4) {
                a6.C = a4;
                a6.C.E(a2, a4, 0);
            }
            a6.C.E(a2, a6.A, a3);
        }
        if (a6.E()) {
            a52 = a3 + a6.b;
            a6.b = 0;
            return a52;
        }
        a6.b += a3;
        return 0;
    }

    public /* synthetic */ void E(long a2) {
        jf_1 a3;
        a3.b = (int)a2;
        int n2 = a3.C;
        synchronized (n2) {
            jf_1 jf_12 = a3;
            jf_12.C.E(a2, a3.c, -1);
            long l2 = jf_12.C.a();
            double d2 = jf_12.a == 0 ? 0.0 : (double)l2 / (double)a3.a;
            a3.k = (int)Math.round(d2);
            return;
        }
    }
}

