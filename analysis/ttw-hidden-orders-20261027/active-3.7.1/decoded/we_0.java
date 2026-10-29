/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.ae_2;
import ttw.tradefinder.dE;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ee;
import ttw.tradefinder.hd_0;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.We
 */
public class we_0
implements ActionListener {
    public final /* synthetic */ JComboBox C;
    public final /* synthetic */ dE M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ze_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ we_0(dE a2, JComboBox a3, df_0 a4, ze_2 a5) {
        we_0 a6;
        we_0 we_02 = a6;
        we_02.M = a2;
        we_02.C = a3;
        a6.b = a4;
        a6.c = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        we_0 a3;
        a2 = ee.E(a3.C.getSelectedItem().toString(), ae_2.c);
        if (a2 != ((za_0)a3.b.M).A) {
            ((za_0)a3.b.M).A = a2;
            a3.M.E().E("TTW-HiddenOrders", a3.c.M, a3.b);
        }
    }
}

