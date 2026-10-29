/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
 */
package ttw.tradefinder;

import java.util.Arrays;
import java.util.TreeMap;
import org.apache.commons.lang3.tuple.Pair;
import ttw.tradefinder.K;
import ttw.tradefinder.LC;
import ttw.tradefinder.Pc;
import ttw.tradefinder.c_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.cd_2;
import ttw.tradefinder.db_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ea_2;
import ttw.tradefinder.ee_1;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.im;
import ttw.tradefinder.jf_0;
import ttw.tradefinder.l_0;
import ttw.tradefinder.n_0;
import ttw.tradefinder.o_0;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.p_0;
import ttw.tradefinder.pe_2;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.s_0;
import ttw.tradefinder.xb_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.wb
 */
public class wb_1
extends xb_2
implements c_0,
o_0,
n_0,
p_0 {
    private static final int h = 100000;
    private static long H = cd_2.M;
    private boolean D;
    private TreeMap<Integer, ee_1> A;
    private final df_0<LC, im> C;
    private final db_2 M;
    private final K b;
    private static final int c = 5000;

    @Override
    public void E(ff_1 a2, jf_0 a3) {
        wb_1 a4;
        if (a2 != ff_1.Ba) {
            return;
        }
        a2 = a4.A;
        synchronized (a2) {
            ee_1 ee_12 = a4.A.get(a3.C);
            if (ee_12 == null) {
                ee_12 = new ee_1(H, 5000, 100000, true);
                a4.A.put(a3.C, ee_12);
            }
            jf_0 jf_02 = a3;
            ee_12.E(a3.A, jf_02.b, jf_02.M);
        }
        if (!a4.D) {
            return;
        }
        a4.M.E(a3.A, a3.C);
    }

    @Override
    public void void_E() {
        wb_1 a2;
        super.void_E();
    }

    @Override
    public boolean boolean_E() {
        wb_1 a2;
        return a2.M.boolean_E();
    }

    @Override
    public l_0 ttw_tradefinder_l_0_E() {
        wb_1 a2;
        return a2.M;
    }

    @Override
    public void E(pf_0 a2) {
        wb_1 a3;
        if (a2 == pf_0.V) {
            wb_1 wb_12 = a3;
            wb_12.a(((LC)wb_12.C.M).M);
            return;
        }
        if (a2 == pf_0.q) {
            a3.M.void_j();
        }
    }

    @Override
    public void void_j(long a2) {
        wb_1 a3;
        a3.M.void_j();
    }

    public wb_1(String a2, f_0 a3, ze_2 a4, s_0 a5) {
        wb_1 a6;
        wb_1 wb_12 = a6;
        super(a3, a4, (s_0)a5);
        a6.A = new TreeMap();
        wb_12.D = false;
        wb_12.C = a3.E(a2, a4.M, new LC());
        a6.C.E(a6);
        a6.D = false;
        wb_1 wb_13 = a6;
        a6.M = new db_2(a4, wb_13, wb_13.C);
        a6.M.E(((LC)a6.C.M).M);
        a5 = new Pc(ff_0.E(".,\u0002!\u0003+)7\u0002 \u0014\u0001\u00033"), Arrays.asList(cd.C, cd.c, cd.D), a3.ttw_tradefinder_qc_1_E());
        a6.b = a5.E(new ea_2(a6, a4, a3, a2));
    }

    @Override
    public Pair<Double, Double> E(int a22, long a32, long a4) {
        wb_1 a5;
        TreeMap<Integer, ee_1> treeMap = a5.A;
        synchronized (treeMap) {
            ee_1 a22 = a5.A.get(a22);
            if (a22 == null) {
                return null;
            }
            int n2 = 0;
            int n3 = 0;
            int a32 = a22.j(a32);
            if (a32 != -1) {
                int n4 = a32 = a32;
                while (n4 < a22.int_E()) {
                    if (a22.long_E(a32) > a4) break;
                    pe_2 pe_22 = a22.ttw_tradefinder_pe_2_E(a32);
                    if (pe_22.b) {
                        n3 += pe_22.c;
                    } else {
                        n2 += pe_22.c;
                    }
                    n4 = ++a32;
                }
            }
            return Pair.of((Object)((double)n2 / ((ze_2)((Object)a5.M)).A), (Object)((double)n3 / ((ze_2)((Object)a5.M)).A));
        }
    }

    @Override
    public void void_E(boolean a22) {
        wb_1 wb_12;
        wb_1 a3;
        if (a22) {
            TreeMap<Integer, ee_1> a22 = a3.A;
            synchronized (a22) {
                a3.A.clear();
                // MONITOREXIT @DISABLED, blocks:[0, 1, 4] lbl6 : MonitorExitStatement: MONITOREXIT : a
                wb_12 = a3;
            }
        } else {
            wb_12 = a3;
        }
        wb_12.M.void_j();
    }

    @Override
    public void E(ff_1 a2, oe_1 a3, boolean a4) {
        wb_1 a5;
        if (a2 != ff_1.Ba) {
            return;
        }
        if (a3 != oe_1.b) {
            return;
        }
        a5.D = a4;
        if (a5.D) {
            a5.void_E(false);
        }
    }

    @Override
    public void E(ff_1 a2) {
        wb_1 a3;
        if (a2 != ff_1.Ba) {
            return;
        }
        a3.void_E(true);
    }

    @Override
    public void void_j() {
        wb_1 a2;
        wb_1 wb_12 = a2;
        super.void_j();
        wb_12.b.void_E();
        wb_12.void_E(true);
        wb_12.M.void_E();
    }

    private /* synthetic */ void a(boolean a2) {
        wb_1 a3;
        if (a2 == a3.M.boolean_E()) {
            return;
        }
        wb_1 wb_12 = a3;
        boolean bl = a2;
        wb_12.M.E(bl);
        wb_12.j(bl);
    }
}

