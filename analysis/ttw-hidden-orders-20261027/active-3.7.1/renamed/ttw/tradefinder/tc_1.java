/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.na_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.tC
 */
public class tc_1
implements ActionListener {
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ bb_1 M;
    public final /* synthetic */ JComboBox b;
    public final /* synthetic */ na_0 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        tc_1 a3;
        a2 = ee.E(a3.b.getSelectedItem().toString(), df_1.b);
        if (a2 != a3.c.c) {
            a3.c.c = a2;
            a3.M.ttw_tradefinder_f_0_E().E(a3.M.ttw_tradefinder_r_0_E().f(), a3.A.M, a3.C);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ tc_1(bb_1 a2, JComboBox a3, na_0 a4, ze_2 a5, df_0 a6) {
        tc_1 a7;
        tc_1 tc_12 = a7;
        a7.M = a2;
        tc_12.b = a3;
        tc_12.c = a4;
        a7.A = a5;
        a7.C = a6;
    }
}

