/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.lang.ref.WeakReference;
import ttw.tradefinder.Oa;
import ttw.tradefinder.T;
import ttw.tradefinder.ac_2;
import ttw.tradefinder.c_0;
import ttw.tradefinder.dc_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ej;
import ttw.tradefinder.et;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.kc_1;
import ttw.tradefinder.l_0;
import ttw.tradefinder.n_0;
import ttw.tradefinder.o_0;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.pb_2;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.s_0;
import ttw.tradefinder.sd_1;
import ttw.tradefinder.ue_0;
import ttw.tradefinder.wc_2;
import ttw.tradefinder.x;
import ttw.tradefinder.xb_2;
import ttw.tradefinder.ze_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.oc
 */
public class oc_2
extends xb_2
implements c_0,
o_0,
n_0,
x {
    private ue_0 i;
    private boolean e;
    private boolean k;
    private static int B;
    private final df_0<Oa, et> K;
    private final boolean E;
    private static int j;
    private static int a;
    private final df_0<dc_2, ej> h;
    private sd_1 H;
    private WeakReference<T> D;
    private pb_2 A;
    private long C;
    private long M;
    private Object b;
    private final wc_2 c;

    private /* synthetic */ void j(pb_2 a2, ac_2 a3) {
        oc_2 a4;
        Object object = a4.b;
        synchronized (object) {
            if (a4.D.get() != null) {
                ((T)a4.D.get()).E(a2, a3);
            }
            return;
        }
    }

    private /* synthetic */ void E(pb_2 a2, ac_2 a3) {
        oc_2 a4;
        a4.M = a2.c;
        a4.c.E(a2, a3);
        a4.A = a2;
    }

    @Override
    public boolean E() {
        oc_2 a2;
        return a2.c.E();
    }

    public void d(long a2) {
        oc_2 a3;
        if (a3.k) {
            return;
        }
        if (!a3.c.E()) {
            return;
        }
        a3.a(a2);
    }

    private /* synthetic */ ac_2 j(long a22) {
        oc_2 a3;
        ac_2 a22 = a3.E(a22);
        if (a22 != null) {
            return a22;
        }
        return new ac_2(((Oa)a3.K.M).H, ((Oa)a3.K.M).D, ((Oa)a3.K.M).G);
    }

    @Override
    public void E() {
        oc_2 a2;
        super.E();
        a2.M = 0L;
    }

    static {
        j = 1000000;
        a = 200000;
        B = 1000;
    }

    @Override
    public l_0 E() {
        oc_2 a2;
        return a2.c;
    }

    private /* synthetic */ void a(long a22) {
        oc_2 a3;
        oc_2 oc_22 = a3;
        pb_2 a22 = oc_22.j(a22);
        if (oc_22.M == a22.c) {
            return;
        }
        oc_2 oc_23 = a3;
        pb_2 pb_22 = a22;
        oc_23.E(pb_22, oc_23.j(pb_22.c));
    }

    @Override
    public void E(ff_1 a2, oe_1 a3, boolean a4) {
        if (a2 != ff_1.o) {
            return;
        }
        if (a3 != oe_1.b) {
            return;
        }
        a.e = a4;
    }

    public pb_2 j(long a22) {
        oc_2 a3;
        pb_2 a22 = a3.E(a22);
        if (a22 != null) {
            return a22;
        }
        return new pb_2();
    }

    @Override
    public void E(pf_0 a2) {
        pf_0 pf_02;
        Object object;
        oc_2 a3;
        if (a2 == pf_0.y || a2 == pf_0.c) {
            object = a3.i;
            synchronized (object) {
                long l2;
                if (a3.i.j() == 0) {
                    l2 = 0L;
                } else {
                    oc_2 oc_22 = a3;
                    l2 = oc_22.i.E(oc_22.i.j() - 1) + 1L;
                }
                long l3 = l2;
                a3.H.E(l3, new ac_2(((Oa)a3.K.M).H, ((Oa)a3.K.M).D, ((Oa)a3.K.M).G));
                // MONITOREXIT @DISABLED, blocks:[0, 2, 12] lbl12 : MonitorExitStatement: MONITOREXIT : var2_4
                pf_02 = a2;
            }
        } else {
            pf_02 = a2;
        }
        if (pf_02 == pf_0.C) {
            oc_2 oc_23 = a3;
            oc_23.E(((dc_2)oc_23.h.M).C != kc_1.A);
        }
        if (a2 == pf_0.v) {
            object = a3.b;
            synchronized (object) {
                if (a3.D.get() != null) {
                    ((T)a3.D.get()).E((float)((dc_2)a3.h.M).c / 10.0f);
                }
                return;
            }
        }
    }

    @Override
    public void E(ff_1 a2, pb_2 a3, long a4) {
        if (a2 == ff_1.o) {
            oc_2 a5;
            a2 = a5.i;
            synchronized (a2) {
                a5.i.E(a4, a3);
            }
            if (a5.C != 0L && a4 > a5.C) {
                oc_2 oc_22 = a5;
                oc_22.d(oc_22.C);
                oc_22.C = 0L;
            }
            if (!a5.E) {
                return;
            }
            if (!a5.e) {
                return;
            }
            oc_2 oc_23 = a5;
            a2 = oc_23.j(a3.c);
            oc_23.j(a3, (ac_2)a2);
            if (oc_23.k) {
                a5.E(a3, (ac_2)a2);
            }
        }
    }

    @Override
    public void E(boolean a22) {
        if (a22) {
            oc_2 a3;
            ue_0 a22 = a3.i;
            synchronized (a22) {
                oc_2 oc_22 = a3;
                oc_22.i.E();
                oc_22.H.E();
                ac_2 ac_22 = new ac_2(((Oa)a3.K.M).H, ((Oa)a3.K.M).D, ((Oa)a3.K.M).G);
                oc_2 oc_23 = a3;
                oc_23.H.E(0L, ac_22);
                oc_23.c.E(new pb_2(), ac_22);
                return;
            }
        }
    }

    @Override
    public void E(long a22) {
        oc_2 a3;
        if (a3.E) {
            return;
        }
        oc_2 oc_22 = a3;
        pb_2 a22 = oc_22.j(a22);
        ac_2 ac_22 = oc_22.j(a22.c);
        oc_22.j(a22, ac_22);
        if (!oc_22.k) {
            return;
        }
        if (!a3.c.E()) {
            return;
        }
        a3.E(a22, ac_22);
    }

    @Override
    public void E(long a2, boolean a3) {
        oc_2 a4;
        if (!a4.e && !a3) {
            a4.C = a2;
        }
        a4.k = a3;
        a4.d(a2);
    }

    @Override
    public void j() {
        oc_2 a2;
        oc_2 oc_22 = a2;
        super.j();
        ue_0 ue_02 = oc_22.i;
        synchronized (ue_02) {
            oc_2 oc_23 = a2;
            oc_23.i.E();
            oc_23.H.E();
        }
        a2.c.E();
        oc_2 oc_24 = a2;
        a2.K.j(oc_24);
        oc_24.h.j(a2);
    }

    private /* synthetic */ ac_2 E(long a22) {
        oc_2 a3;
        ue_0 ue_02 = a3.i;
        synchronized (ue_02) {
            int a22 = a3.H.E(a22);
            if (a22 == -1) {
                return null;
            }
            return a3.H.E(a22);
        }
    }

    public boolean E(boolean a2) {
        oc_2 a3;
        if (a3.c.E() == a2) {
            return false;
        }
        oc_2 oc_22 = a3;
        boolean bl = a2;
        oc_22.c.E(bl);
        oc_22.j(bl);
        return true;
    }

    @Override
    public void E(ff_1 a2) {
        oc_2 a3;
        if (a2 != ff_1.o) {
            return;
        }
        a3.E(true);
    }

    public void E(T a2) {
        oc_2 a3;
        Object object = a3.b;
        synchronized (object) {
            a3.D = new WeakReference<T>(a2);
            return;
        }
    }

    public pb_2 E() {
        oc_2 a2;
        return a2.A;
    }

    public oc_2(String a2, f_0 a3, ze_2 a4, s_0 a5) {
        oc_2 a6;
        f_0 f_02 = a3;
        oc_2 oc_22 = a6;
        oc_2 oc_23 = a6;
        oc_2 oc_24 = a6;
        oc_2 oc_25 = a6;
        super(a3, a4, a5);
        oc_25.M = 0L;
        oc_25.C = 0L;
        oc_24.A = new pb_2();
        oc_24.i = new ue_0(a, j, true);
        oc_24.H = new sd_1(B);
        oc_23.b = new Object();
        oc_23.D = new WeakReference<Object>(null);
        oc_23.k = false;
        oc_22.e = false;
        oc_22.K = a3.E(a2, a4.M, new Oa(a4.A));
        a6.K.E(a6);
        a6.h = f_02.E(a2, a4.M, new dc_2());
        a6.h.E(a6);
        a6.c = new wc_2(a2, a3, a4, a6.h, a6);
        a6.E = f_02.j();
        a6.e = false;
        a6.H.E(0L, new ac_2(((Oa)a6.K.M).H, ((Oa)a6.K.M).D, ((Oa)a6.K.M).G));
    }

    private /* synthetic */ pb_2 E(long a22) {
        oc_2 a3;
        ue_0 ue_02 = a3.i;
        synchronized (ue_02) {
            int a22 = a3.i.E(a22);
            if (a22 == -1) {
                return null;
            }
            return a3.i.E(a22);
        }
    }

    @Override
    public void j(long a2) {
        oc_2 a3;
        if (a3.E) {
            return;
        }
        a3.M = 0L;
        a3.E(a2);
    }
}

