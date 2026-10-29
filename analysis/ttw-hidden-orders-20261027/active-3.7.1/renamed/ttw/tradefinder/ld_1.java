/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.oa_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ub_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.ld
 */
public class ld_1
implements ActionListener {
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ bb_1 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ld_1(bb_1 a2, df_0 a3, ze_2 a4) {
        ld_1 a5;
        a5.c = a2;
        a5.b = a3;
        a5.M = a4;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        ld_1 a3;
        ((oa_0)a3.b.M).E(new ub_2(a3));
        ((oa_0)a3.b.M).void_E();
        ld_1 ld_12 = a3;
        ld_1 ld_13 = a3;
        ld_12.c.ttw_tradefinder_f_0_E().E(ld_13.c.ttw_tradefinder_r_0_E().f(), a3.M.M, a3.b);
        ld_12.b.E(pf_0.r);
        ld_13.c.A(a3.M.M);
    }
}

