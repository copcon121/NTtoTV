/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.Ff;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.bf_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.na_0;
import ttw.tradefinder.q_0;
import ttw.tradefinder.ve_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Qc
 */
public class qc_2
implements q_0 {
    public final /* synthetic */ na_0 C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ bb_1 c;

    @Override
    public String E(boolean a2) {
        qc_2 a3;
        if (a2) {
            return a3.C.A.E(a3.b.D, ve_2.V, ve_2.j, ve_2.m, Ff.E("\u0002"));
        }
        return a3.C.A.E(a3.b.D, ve_2.V, ve_2.m, bf_0.E("\u001c"));
    }

    @Override
    public boolean boolean_E() {
        qc_2 a2;
        return a2.c.ttw_tradefinder_f_0_E().boolean_E();
    }

    @Override
    public void void_E() {
        qc_2 a2;
        a2.c.ttw_tradefinder_f_0_E().E(a2.c.ttw_tradefinder_r_0_E().f(), a2.b.M, a2.M);
    }

    @Override
    public boolean boolean_j() {
        return false;
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ qc_2(bb_1 a2, ze_2 a3, df_0 a4, na_0 a5) {
        qc_2 a6;
        qc_2 qc_22 = a6;
        qc_22.c = a2;
        qc_22.b = a3;
        a6.M = a4;
        a6.C = a5;
    }

    @Override
    public void void_j() {
        qc_2 a2;
        a2.c.ttw_tradefinder_f_0_E().j(a2.C.A.E(a2.b.D, ve_2.V, ve_2.j, ve_2.m, false));
    }
}

