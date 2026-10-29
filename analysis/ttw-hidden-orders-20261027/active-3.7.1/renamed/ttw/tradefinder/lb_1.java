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
import ttw.tradefinder.hc_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.LB
 */
public class lb_1
implements ActionListener {
    public final /* synthetic */ JComboBox C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ gd_0 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        lb_1 a3;
        a2 = ee.E(a3.C.getSelectedItem().toString(), df_1.b);
        if (a2 != ((Oa)a3.M.M).A) {
            ((Oa)a3.M.M).A = a2;
            a3.c.ttw_tradefinder_f_0_E().E(hc_0.E("u\u0010vim-P1H H0X\u0010S%B/D6"), a3.b.M, a3.M);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ lb_1(gd_0 a2, JComboBox a3, df_0 a4, ze_2 a5) {
        lb_1 a6;
        lb_1 lb_12 = a6;
        lb_12.c = a2;
        lb_12.C = a3;
        a6.M = a4;
        a6.b = a5;
    }
}

