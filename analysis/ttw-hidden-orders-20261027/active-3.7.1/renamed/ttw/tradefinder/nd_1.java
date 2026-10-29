/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.Zc;
import ttw.tradefinder.df_0;
import ttw.tradefinder.fg;
import ttw.tradefinder.q_0;
import ttw.tradefinder.qe_2;
import ttw.tradefinder.ve_2;
import ttw.tradefinder.xf_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.ND
 */
public class nd_1
implements q_0 {
    public final /* synthetic */ fg M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ df_0 c;

    @Override
    public void void_E() {
        nd_1 a2;
        a2.M.ttw_tradefinder_f_0_E().E(qe_2.E("^[]\"Cbhnfndlo[xnido}"), a2.b.M, a2.c);
    }

    @Override
    public void void_j() {
        nd_1 a2;
        a2.M.ttw_tradefinder_f_0_E().j(((Zc)a2.c.M).B.E(a2.b.D, ve_2.b, ve_2.J, ve_2.C, false));
    }

    @Override
    public boolean boolean_j() {
        return false;
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ nd_1(fg a2, ze_2 a3, df_0 a4) {
        nd_1 a5;
        a5.M = a2;
        a5.b = a3;
        a5.c = a4;
    }

    @Override
    public boolean boolean_E() {
        nd_1 a2;
        return a2.M.ttw_tradefinder_f_0_E().boolean_E();
    }

    @Override
    public String E(boolean a2) {
        nd_1 a3;
        if (a2) {
            return ((Zc)a3.c.M).B.E(a3.b.D, ve_2.b, ve_2.J, ve_2.C, xf_0.E("<"));
        }
        return ((Zc)a3.c.M).B.E(a3.b.D, ve_2.b, ve_2.C, qe_2.E("/"));
    }
}

