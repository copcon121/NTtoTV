/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.ob_1;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Hc
 */
public class hc_2
implements ActionListener {
    public final /* synthetic */ JComboBox C;
    public final /* synthetic */ ob_1 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        hc_2 a3;
        a2 = ee.E(a3.C.getSelectedItem().toString(), df_1.b);
        if (a2 != ((ua_0)a3.b.M).A) {
            ((ua_0)a3.b.M).A = a2;
            a3.M.ttw_tradefinder_f_0_E().E(a3.M.ttw_tradefinder_r_0_E().f(), a3.c.M, a3.b);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ hc_2(ob_1 a2, JComboBox a3, df_0 a4, ze_2 a5) {
        hc_2 a6;
        hc_2 hc_22 = a6;
        hc_22.M = a2;
        hc_22.C = a3;
        a6.b = a4;
        a6.c = a5;
    }
}

