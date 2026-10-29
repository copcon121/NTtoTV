/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.function.Consumer;
import ttw.tradefinder.Ff;
import ttw.tradefinder.V;
import ttw.tradefinder.c_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.l_0;
import ttw.tradefinder.o_0;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.pa_2;
import ttw.tradefinder.qe_2;
import ttw.tradefinder.s_0;
import ttw.tradefinder.xb_2;
import ttw.tradefinder.ze_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.ZA
 */
public class za_2
extends xb_2
implements c_0,
o_0,
V {
    private static int D = 2000;
    private final Object A;
    private boolean C;
    private qe_2 M;
    private final pa_2 b;
    private boolean c;

    @Override
    public void E() {
        za_2 a2;
        super.E();
    }

    @Override
    public void j(long a2) {
        za_2 a3;
        if (!a3.c) {
            return;
        }
        if (!a3.b.E()) {
            return;
        }
        a3.b.E(true);
    }

    private /* synthetic */ void a(boolean a2) {
        za_2 a3;
        if (a2 == a3.b.E()) {
            return;
        }
        za_2 za_22 = a3;
        boolean bl = a2;
        za_22.b.j(bl);
        za_22.j(bl);
    }

    @Override
    public void E(ff_1 a2, Ff a3) {
        if (a2 == ff_1.d) {
            za_2 a4;
            a2 = a4.A;
            synchronized (a2) {
                a4.M.E(a3.C, a3);
            }
            if (a4.c && a4.C) {
                a4.b.E(true);
            }
        }
    }

    @Override
    public void a(long a2) {
        za_2 a3;
        if (a3.c) {
            return;
        }
        if (!a3.b.E()) {
            return;
        }
        a3.b.E(true);
    }

    @Override
    public void j() {
        za_2 a2;
        za_2 za_22 = a2;
        super.j();
        za_22.E(true);
        za_22.b.E();
    }

    @Override
    public boolean E() {
        za_2 a2;
        return a2.b.E();
    }

    public za_2(String a2, f_0 a3, ze_2 a4, s_0 a5) {
        za_2 a6;
        za_2 za_22 = a6;
        za_2 za_23 = a6;
        super(a3, a4, a5);
        za_23.A = new Object();
        za_23.M = new qe_2(D);
        za_23.c = false;
        za_22.C = false;
        za_22.b = new pa_2(a6);
        za_22.c = a3.j();
    }

    @Override
    public void E(boolean a22) {
        za_2 za_22;
        za_2 a3;
        if (a22) {
            Object a22 = a3.A;
            synchronized (a22) {
                a3.M.E();
                // MONITOREXIT @DISABLED, blocks:[0, 1, 4] lbl6 : MonitorExitStatement: MONITOREXIT : a
                za_22 = a3;
            }
        } else {
            za_22 = a3;
        }
        za_22.b.E(true);
    }

    @Override
    public void E(long a22, long a3, Consumer<Ff> a4) {
        za_2 a5;
        if (a22 >= a3) {
            return;
        }
        Object object = a5.A;
        synchronized (object) {
            int a22 = a5.M.j(a22);
            if (a22 == -1) {
                return;
            }
            int n2 = a22 = a22;
            while (n2 < a5.M.E()) {
                if (a5.M.E(a22) > a3) {
                    return;
                }
                a4.accept(a5.M.E(a22++));
                n2 = a22;
            }
            return;
        }
    }

    @Override
    public void E(ff_1 a2, oe_1 a3, boolean a4) {
        if (a2 != ff_1.d) {
            return;
        }
        if (a3 == oe_1.M) {
            za_2 a5;
            a5.a(a4);
            return;
        }
        if (a3 != oe_1.b) {
            a5.C = a4;
        }
    }

    @Override
    public l_0 E() {
        za_2 a2;
        return a2.b;
    }

    @Override
    public void E(ff_1 a2) {
        if (a2 == ff_1.d) {
            za_2 a3;
            a3.E(false);
        }
    }
}

