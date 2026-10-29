/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.TradeInfo
 */
package ttw.tradefinder;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import ttw.tradefinder.K;
import ttw.tradefinder.O;
import ttw.tradefinder.Pc;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.bf_2;
import ttw.tradefinder.c_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.cf_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.f_0;
import ttw.tradefinder.gb_1;
import ttw.tradefinder.hK;
import ttw.tradefinder.hg_0;
import ttw.tradefinder.ie_0;
import ttw.tradefinder.l_0;
import ttw.tradefinder.n_0;
import ttw.tradefinder.nd_2;
import ttw.tradefinder.o_0;
import ttw.tradefinder.oa_0;
import ttw.tradefinder.oc_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.qd_2;
import ttw.tradefinder.ra_1;
import ttw.tradefinder.s_0;
import ttw.tradefinder.te_1;
import ttw.tradefinder.uc_0;
import ttw.tradefinder.x_0;
import ttw.tradefinder.xb_2;
import ttw.tradefinder.ze_2;
import velox.api.layer1.data.TradeInfo;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.OA
 */
public class oa_2
extends xb_2
implements c_0,
x_0,
o_0,
n_0,
O {
    private final ra_1 E;
    private boolean j;
    private boolean a;
    private int h;
    private final bb_1 H;
    private final uc_0 D;
    private final String A;
    private final K C;
    private int M;
    private final cf_2 b;
    private final df_0<oa_0, hK> c;

    @Override
    public void E(pf_0 a2) {
        if (a2 == pf_0.r) {
            oa_2 a3;
            a3.d();
        }
    }

    private /* synthetic */ Map<String, String> E(gb_1 a2) {
        oa_2 a3;
        HashMap<String, String> hashMap = new HashMap<String, String>();
        hashMap.put(ie_0.E("\u0016\u00005\u0004"), a2.c.b);
        hashMap.put(nd_2.E("iXPI\\"), a3.M.j(a2.c.H));
        return hashMap;
    }

    public static /* synthetic */ ze_2 j(oa_2 a2) {
        return a2.M;
    }

    @Override
    public void j() {
        oa_2 a2;
        oa_2 oa_22 = a2;
        super.j();
        oa_22.C.E();
        oa_22.b.E();
        oa_22.c.j(a2);
        oa_22.E.E();
        oa_22.D.E();
    }

    public oa_2(String a2, f_0 a3, ze_2 a4, bb_1 a5, s_0 a6) {
        oa_2 a7;
        oa_2 oa_22 = a7;
        oa_2 oa_23 = a7;
        oa_2 oa_24 = a7;
        oa_2 oa_25 = a7;
        super(a3, a4, a6);
        oa_25.j = false;
        oa_25.a = false;
        oa_24.M = 0;
        oa_24.h = 0;
        oa_23.A = a2;
        oa_23.H = a5;
        oa_22.b = oa_22.E();
        oa_22.c = a3.E(oa_22.A, a4.M, new oa_0());
        a7.c.E(a7);
        a7.D = new uc_0(a7.c);
        a7.E = new ra_1(a7);
        a2 = new Pc(ie_0.E("\b\u00131\u0002= 4\u0004*\u0015+,=\u0012+\u00046\u0006=\u0013"), Arrays.asList(cd.C, cd.c, cd.D), a3.E());
        a7.C = a2.E(null);
        a7.j = a3.j();
        a7.a = false;
        a7.E();
        a7.d();
    }

    @Override
    public void E(gb_1 a2) {
        oa_2 a3;
        if (!(a3.j && a3.a && a2.c.C)) {
            return;
        }
        ((oa_0)a3.c.M).j(a2.b);
        oa_2 oa_22 = a3;
        oa_2 oa_23 = a3;
        oa_2 oa_24 = a3;
        oa_23.D.E(oa_23.A, oa_24.M.M, a3.c);
        oa_24.c.E(pf_0.r);
        oa_22.H.A(a3.M.M);
        String string = oa_22.E(a2);
        qd_2 qd_22 = oa_22.E(a2);
        if (!string.isEmpty() && a2.c.c == df_1.c) {
            oa_2 oa_25 = a3;
            oa_25.E(oa_25.M.M, string);
        }
        if (qd_22.c != te_1.A) {
            a3.E(qd_22);
        }
        if (a2.c.D == df_1.c) {
            oa_2 oa_26 = a3;
            if (oa_26.C.E(oa_26.M.j)) {
                oa_2 oa_27;
                bf_2 bf_22;
                cf_2 cf_22 = a3.b;
                if (a2.M) {
                    bf_22 = bf_2.b;
                    oa_27 = a3;
                } else {
                    bf_22 = bf_2.c;
                    oa_27 = a3;
                }
                cf_22.E(hg_0.a, bf_22, oa_27.E(a2));
            }
        }
    }

    @Override
    public void E(long a2, int a3, int a4, TradeInfo a5) {
        oa_2 oa_22;
        oa_2 a6;
        if (!a6.E()) {
            return;
        }
        if (a5.isBidAggressor) {
            if (a6.M == a3) {
                return;
            }
            oa_22 = a6;
            a6.M = a3;
        } else {
            if (a6.h == a3) {
                return;
            }
            oa_22 = a6;
            a6.h = a3;
        }
        if (oa_22.M == 0 || a6.h == 0) {
            return;
        }
        if (!a6.j || !a6.a) {
            return;
        }
        oa_2 oa_23 = a6;
        oa_23.D.E(oa_23.h);
        oa_2 oa_24 = a6;
        oa_23.E.E(oa_24.M, oa_24.h);
    }

    public static /* synthetic */ ze_2 E(oa_2 a2) {
        return a2.M;
    }

    @Override
    public boolean E() {
        oa_2 a2;
        return a2.D.j();
    }

    private /* synthetic */ void d() {
        oa_2 a2;
        oa_2 oa_22 = a2;
        oa_22.E.j();
        if (!oa_22.E()) {
            return;
        }
        ((oa_0)a2.c.M).E(new oc_0(a2));
    }

    public static /* synthetic */ f_0 E(oa_2 a2) {
        return a2.D;
    }

    private /* synthetic */ qd_2 E(gb_1 a2) {
        oa_2 a3;
        String string = a2.M ? nd_2.E("{C]") : ie_0.E(" +\n");
        String string2 = a3.M.j(a2.c.H);
        return a2.c.A.E(a3.M.D, string + " Price reached", "at " + string2, string2, a2.M);
    }

    @Override
    public void E(boolean a2) {
        oa_2 a3;
        a3.D.j();
    }

    @Override
    public void E() {
        oa_2 a2;
        super.E();
        a2.a = false;
    }

    @Override
    public void a() {
        oa_2 a2;
        if (a2.a) {
            return;
        }
        a2.a = true;
        a2.E(false);
    }

    @Override
    public l_0 E() {
        oa_2 a2;
        return a2.D;
    }

    private /* synthetic */ String E(gb_1 a2) {
        oa_2 a3;
        String string = a2.M ? nd_2.E("ixpi|\nxf|xm\n{c}") : ie_0.E("1\n(\u001b$x \u0014$\n5x \u000b*");
        return String.format(nd_2.E("\u000fJ\n\u001b\u000fJ\b\u0015\nX^\u0019\u000fJ"), string, a2.c.b, a3.M.j(a2.c.H));
    }
}

