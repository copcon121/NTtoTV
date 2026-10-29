/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.Oa;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.q_0;
import ttw.tradefinder.sd_1;
import ttw.tradefinder.ve_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.aA
 */
public class aa_2
implements q_0 {
    public final /* synthetic */ gd_0 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ aa_2(gd_0 a2, ze_2 a3, df_0 a4) {
        aa_2 a5;
        a5.M = a2;
        a5.b = a3;
        a5.c = a4;
    }

    @Override
    public void void_E() {
        aa_2 a2;
        a2.M.ttw_tradefinder_f_0_E().E(sd_1.E("ukv\u0012mVPJH[HKXkS^BTDM"), a2.b.M, a2.c);
    }

    @Override
    public void void_j() {
        aa_2 a2;
        a2.M.ttw_tradefinder_f_0_E().j(((Oa)a2.c.M).B.E(a2.b.D, ve_2.X, ve_2.z, ve_2.d, false));
    }

    @Override
    public boolean boolean_j() {
        return true;
    }

    @Override
    public String E(boolean a2) {
        aa_2 a3;
        if (a2) {
            return ((Oa)a3.c.M).B.E(a3.b.D, ve_2.X, ve_2.z, ve_2.d, cc_0.E("t"));
        }
        return ((Oa)a3.c.M).B.E(a3.b.D, ve_2.X, ve_2.d, sd_1.E("\u001f"));
    }

    @Override
    public boolean boolean_E() {
        aa_2 a2;
        return a2.M.ttw_tradefinder_f_0_E().boolean_E();
    }
}

