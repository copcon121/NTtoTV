/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Arrays;
import java.util.Collections;
import java.util.function.Consumer;
import ttw.tradefinder.K;
import ttw.tradefinder.Oe;
import ttw.tradefinder.Pc;
import ttw.tradefinder.R;
import ttw.tradefinder.c_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ed_0;
import ttw.tradefinder.el;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.ge_0;
import ttw.tradefinder.in;
import ttw.tradefinder.jf_1;
import ttw.tradefinder.l_0;
import ttw.tradefinder.mb_1;
import ttw.tradefinder.n_0;
import ttw.tradefinder.o_0;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.s_0;
import ttw.tradefinder.te_0;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.wc_0;
import ttw.tradefinder.xb_2;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.yC
 */
public class yc_2
extends xb_2
implements c_0,
o_0,
n_0,
R {
    private boolean E;
    private final mb_1 j;
    private static int a = 20000;
    private ge_0 h;
    private boolean H;
    private final K D;
    private final Object A;
    private te_0 C;
    private final df_0<ua_0, in> M;
    private boolean b;
    private final df_0<za_0, el> c;

    @Override
    public void E(ff_1 a2, oe_1 a3, boolean a4) {
        if (a2 != ff_1.s) {
            return;
        }
        if (a3 != oe_1.b) {
            return;
        }
        a.E = a4;
    }

    @Override
    public void j(long a22, long a3, Consumer<Oe> a4) {
        yc_2 a5;
        if (a22 >= a3) {
            return;
        }
        Object object = a5.A;
        synchronized (object) {
            int a22 = a5.C.E(a22);
            if (a22 == -1) {
                return;
            }
            int n2 = a22 = a22;
            while (n2 < a5.C.j()) {
                if (a5.C.E(a22) > a3) {
                    return;
                }
                a4.accept(a5.C.E(a22++));
                n2 = a22;
            }
            return;
        }
    }

    @Override
    public void E(pf_0 a2) {
        block8: {
            yc_2 a3;
            block6: {
                block7: {
                    if (a2 != pf_0.L) break block6;
                    if (!((ua_0)a3.M.M).j) break block7;
                    yc_2 yc_22 = a3;
                    if (!yc_22.D.E(((ze_2)((Object)yc_22.M)).j)) break block8;
                }
                yc_2 yc_23 = a3;
                yc_23.d(((ua_0)yc_23.M.M).j);
                if (((ua_0)a3.M.M).j) {
                    a3.j.E(true);
                    return;
                }
                break block8;
            }
            if (a2 == pf_0.B || a2 == pf_0.Y) {
                a3.j.E(true);
                return;
            }
            if (a2 == pf_0.m || a2 == pf_0.P) {
                if (a3.b || !a3.j.E()) {
                    return;
                }
                yc_2 yc_24 = a3;
                yc_24.A(yc_24.j.E());
            }
        }
    }

    @Override
    public void A(long a2) {
        int n2;
        yc_2 a3;
        if (a3.b) {
            return;
        }
        if (!a3.j.E()) {
            return;
        }
        yc_2 yc_22 = a3;
        yc_22.j.j();
        if (yc_22.h != null) {
            yc_2 yc_23 = a3;
            yc_23.j.E(yc_23.h);
        }
        if ((n2 = a3.C.E(a2 + 1L)) == -1) {
            return;
        }
        int n3 = n2 = n2;
        while (n3 < a3.C.j()) {
            ge_0 ge_02 = a3.C.E(n2);
            if (ge_02.c < a2) {
                yc_2 yc_24 = a3;
                if (ge_02.E(a2) >= ((ua_0)a3.M.M).E((ze_2)((Object)yc_24.M), ((za_0)yc_24.c.M).a)) {
                    a3.j.E(ge_02);
                }
            }
            n3 = ++n2;
        }
        a3.j.E(true);
    }

    public void d() {
        yc_2 a2;
        if (!a2.H) {
            return;
        }
        if (!a2.j.E()) {
            return;
        }
        yc_2 yc_22 = a2;
        yc_2 yc_23 = a2;
        ge_0 ge_02 = yc_22.j(yc_22.h == null ? yc_23.j.E() : yc_23.h.b);
        if (ge_02 != null && a2.j.E(ge_02.b, ge_02.b)) {
            if (a2.h != null) {
                yc_2 yc_24 = a2;
                yc_24.j.j(yc_24.h);
            }
            a2.h = ge_02;
            a2.j.E(a2.h);
        }
    }

    @Override
    public void j(long a2) {
        yc_2 a3;
        if (!a3.b) {
            return;
        }
        if (!a3.j.E()) {
            return;
        }
        a3.j.E(true);
    }

    public yc_2(String a2, f_0 a3, ze_2 a4, s_0 a5) {
        yc_2 a6;
        yc_2 yc_22 = a6;
        yc_2 yc_23 = a6;
        yc_2 yc_24 = a6;
        super(a3, a4, (s_0)a5);
        a6.A = new Object();
        a6.C = new te_0(a);
        yc_24.H = false;
        yc_24.h = null;
        yc_23.b = false;
        yc_23.E = false;
        yc_22.M = a3.E(a2, a4.M, new ua_0());
        yc_22.c = a3.E(a2, a4.M, new za_0(a4.A));
        yc_2 yc_25 = a6;
        a6.M.E(yc_25);
        yc_25.c.E(a6);
        a6.j = new mb_1(a4, a6.M, a6, a3.j());
        a5 = new Pc("HiddenOrderTrace", Collections.singletonList(cd.C), Arrays.asList(dd_1.c), a3.E());
        a6.D = a5.E(new wc_0(a6, a4, a3, a2));
        a6.b = a3.j();
        a6.j.j(((ua_0)a6.M.M).j);
    }

    private /* synthetic */ ge_0 a(long a22) {
        yc_2 a3;
        Object object = a3.A;
        synchronized (object) {
            int a22 = a3.C.E(a22 + 1L);
            if (a22 == -1) {
                return null;
            }
            return a3.C.E(a22);
        }
    }

    @Override
    public void E() {
        yc_2 a2;
        super.E();
    }

    @Override
    public void E(ff_1 a2) {
        yc_2 a3;
        if (a2 == ff_1.s) {
            a3.E(false);
            return;
        }
        if (a2 == ff_1.g) {
            if (!a3.b) {
                yc_2 yc_22 = a3;
                yc_22.A(yc_22.j.E());
                return;
            }
            yc_2 yc_23 = a3;
            yc_23.j.j();
            if (!yc_23.j.E()) {
                return;
            }
            if (a3.h != null && a3.H) {
                yc_2 yc_24 = a3;
                yc_24.j.E(yc_24.h);
            }
        }
    }

    private /* synthetic */ ge_0 j(long a22) {
        yc_2 a3;
        Object object = a3.A;
        synchronized (object) {
            int a22 = a3.C.j(a22 - 1L);
            if (a22 == -1) {
                return null;
            }
            return a3.C.E(a22);
        }
    }

    @Override
    public boolean E() {
        yc_2 a2;
        return a2.j.E();
    }

    public void a() {
        yc_2 a2;
        if (!a2.H) {
            return;
        }
        if (!a2.j.E()) {
            return;
        }
        yc_2 yc_22 = a2;
        yc_2 yc_23 = a2;
        ge_0 ge_02 = yc_22.a(yc_22.h == null ? yc_23.j.E() : yc_23.h.b);
        if (ge_02 != null && a2.j.E(ge_02.b, ge_02.b)) {
            if (a2.h != null) {
                yc_2 yc_24 = a2;
                yc_24.j.j(yc_24.h);
            }
            a2.h = ge_02;
            a2.j.E(a2.h);
        }
    }

    @Override
    public void j() {
        yc_2 a2;
        yc_2 yc_22 = a2;
        yc_2 yc_23 = a2;
        super.j();
        yc_22.E(true);
        yc_23.j.E();
        yc_22.D.E();
        yc_22.M.j(a2);
        yc_22.c.j(a2);
    }

    @Override
    public void E(ff_1 a2, jf_1 a3) {
        yc_2 a4;
        if (a2 == ff_1.s) {
            a2 = a4.A;
            synchronized (a2) {
                a4.C.E(a3.b, ge_0.E(a3));
            }
            if (a4.b && a4.E && ((ua_0)a4.M.M).D == df_1.c) {
                a4.j.E(true);
                return;
            }
        } else if (a4.b && a4.j.E()) {
            if (a2 == ff_1.g) {
                a4.j.E(a3);
                return;
            }
            if (a2 == ff_1.e) {
                a4.j.j(a3);
            }
        }
    }

    private /* synthetic */ void d(boolean a2) {
        yc_2 a3;
        if (a2 == a3.j.E()) {
            return;
        }
        yc_2 yc_22 = a3;
        boolean bl = a2;
        yc_22.j.j(bl);
        yc_22.j(bl);
    }

    private /* synthetic */ ge_0 E(long a22) {
        yc_2 a3;
        Object object = a3.A;
        synchronized (object) {
            int a22 = a3.C.j(a22);
            if (a22 == -1) {
                return null;
            }
            return a3.C.E(a22);
        }
    }

    @Override
    public void E(boolean a22) {
        yc_2 a3;
        if (a22) {
            Object a22 = a3.A;
            synchronized (a22) {
                a3.C.j();
            }
            if (a3.h != null) {
                a3.j.j(a3.h);
                a3.h = null;
            }
        }
        a3.j.E(true);
    }

    @Override
    public l_0 E() {
        yc_2 a2;
        return a2.j;
    }

    public void a(boolean a22) {
        yc_2 a3;
        a3.H = a22;
        if (!a3.j.E()) {
            return;
        }
        if (a3.h != null) {
            yc_2 yc_22 = a3;
            yc_22.j.j(yc_22.h);
        }
        if (!a22) {
            a3.h = null;
            return;
        }
        yc_2 yc_23 = a3;
        ge_0 a22 = yc_23.E(yc_23.j.E());
        if (a22 != null) {
            a3.h = a22;
            a3.j.E(a3.h);
        }
    }
}

