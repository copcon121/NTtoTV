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
import ttw.tradefinder.lg;
import ttw.tradefinder.sd_1;
import ttw.tradefinder.xa_0;
import ttw.tradefinder.ze_2;

public class wD
implements ActionListener {
    public final /* synthetic */ lg C;
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ wD(lg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        wD a6;
        wD wD2 = a6;
        wD2.C = a2;
        wD2.M = a3;
        a6.c = a4;
        a6.b = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        wD a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), df_1.b);
        if (a2 != ((xa_0)a3.c.M).C) {
            ((xa_0)a3.c.M).C = a2;
            a3.C.ttw_tradefinder_f_0_E().E(sd_1.E("ukv\u0012l^STDKdGQSNMDM"), a3.b.M, a3.c);
        }
    }
}

