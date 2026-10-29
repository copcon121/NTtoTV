/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ee;
import ttw.tradefinder.ob_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.uc_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.hC
 */
public class hc_1
implements ActionListener {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ ob_1 M;
    public final /* synthetic */ JComboBox b;
    public final /* synthetic */ df_0 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        hc_1 a3;
        a2 = ee.E(a3.b.getSelectedItem().toString(), uc_2.M);
        if (a2 != ((ua_0)a3.c.M).a) {
            ((ua_0)a3.c.M).a = a2;
            hc_1 hc_12 = a3;
            a3.M.E().E(a3.M.E().f(), hc_12.C.M, a3.c);
            hc_12.c.E(pf_0.B);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ hc_1(ob_1 a2, JComboBox a3, df_0 a4, ze_2 a5) {
        hc_1 a6;
        hc_1 hc_12 = a6;
        hc_12.M = a2;
        hc_12.b = a3;
        a6.c = a4;
        a6.C = a5;
    }
}

