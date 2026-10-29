/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.ae_1;
import ttw.tradefinder.dE;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;

public class eg
implements ActionListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ JComboBox b;
    public final /* synthetic */ dE c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ eg(dE a2, JComboBox a3, df_0 a4, ze_2 a5) {
        eg a6;
        eg eg2 = a6;
        eg2.c = a2;
        eg2.b = a3;
        a6.C = a4;
        a6.M = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        eg a3;
        a2 = ee.E(a3.b.getSelectedItem().toString(), df_1.b);
        if (a2 != ((za_0)a3.C.M).c) {
            ((za_0)a3.C.M).c = a2;
            a3.c.E().E(ae_1.E("PuS\fLH`EaOKS`DvR"), a3.M.M, a3.C);
        }
    }
}

