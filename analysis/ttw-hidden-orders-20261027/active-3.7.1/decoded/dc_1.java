/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JButton;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.na_0;
import ttw.tradefinder.oa_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Dc
 */
public class dc_1
implements ActionListener {
    public final /* synthetic */ JButton D;
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ bb_1 M;
    public final /* synthetic */ sc_1 b;
    public final /* synthetic */ sc_1 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        dc_1 a3;
        a2 = new na_0();
        int n2 = ((oa_0)a3.C.M).E((na_0)a2);
        dc_1 dc_12 = a3;
        dc_1 dc_13 = a3;
        dc_12.M.E().E(dc_13.M.E().f(), a3.A.M, a3.C);
        dc_12.C.E(pf_0.r);
        if (((oa_0)dc_13.C.M).E() >= bb_1.M) {
            dc_1 dc_14 = a3;
            a3.b.E(dc_14.D);
            dc_14.D.setEnabled(false);
        }
        dc_1 dc_15 = a3;
        dc_1 dc_16 = a3;
        dc_1 dc_17 = a3;
        dc_15.c.j(dc_15.b, dc_16.M.E(dc_16.A, n2, (na_0)a2, dc_17.b, dc_17.c, a3.C));
        dc_15.M.l(a3.A.M);
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ dc_1(bb_1 a2, df_0 a3, ze_2 a4, sc_1 a5, JButton a6, sc_1 a7) {
        dc_1 a8;
        dc_1 dc_12 = a8;
        dc_1 dc_13 = a8;
        dc_13.M = a2;
        dc_13.C = a3;
        dc_12.A = a4;
        dc_12.b = a5;
        a8.D = a6;
        a8.c = a7;
    }
}

