/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.dE;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.sd_1;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;

public class Le
implements ActionListener {
    public final /* synthetic */ dE C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ JComboBox b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Le(dE a2, JComboBox a3, df_0 a4, ze_2 a5) {
        Le a6;
        Le le = a6;
        le.C = a2;
        le.b = a3;
        a6.c = a4;
        a6.M = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        Le a3;
        a2 = ee.E(a3.b.getSelectedItem().toString(), df_1.b);
        if (a2 != ((za_0)a3.c.M).H) {
            ((za_0)a3.c.M).H = a2;
            a3.C.ttw_tradefinder_f_0_E().E(sd_1.E("ukv\u0012iVE[DQnMEZSL"), a3.M.M, a3.c);
        }
    }
}

