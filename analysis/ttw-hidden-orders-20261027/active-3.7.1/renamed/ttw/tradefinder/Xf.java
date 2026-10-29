/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.Oa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.qe_2;
import ttw.tradefinder.ze_2;

public class Xf
implements ActionListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ JComboBox b;
    public final /* synthetic */ gd_0 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        Xf a3;
        a2 = ee.E(a3.b.getSelectedItem().toString(), df_1.b);
        if (a2 != ((Oa)a3.C.M).F) {
            ((Oa)a3.C.M).F = a2;
            a3.c.ttw_tradefinder_f_0_E().E(qe_2.E("^[]\"Ff{zckc{s[xnido}"), a3.M.M, a3.C);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Xf(gd_0 a2, JComboBox a3, df_0 a4, ze_2 a5) {
        Xf a6;
        Xf xf = a6;
        xf.c = a2;
        xf.b = a3;
        a6.C = a4;
        a6.M = a5;
    }
}

