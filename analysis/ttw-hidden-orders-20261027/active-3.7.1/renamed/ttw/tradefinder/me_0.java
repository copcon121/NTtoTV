/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.Zc;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.fg;
import ttw.tradefinder.hc_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.mE
 */
public class me_0
implements ActionListener {
    public final /* synthetic */ JComboBox C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ fg b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        me_0 a3;
        a2 = ee.E(a3.C.getSelectedItem().toString(), df_1.b);
        if (a2 != ((Zc)a3.M.M).A) {
            ((Zc)a3.M.M).A = a2;
            a3.b.ttw_tradefinder_f_0_E().E(hc_0.E("u\u0010vih)C%M%O'D\u0010S%B/D6"), a3.c.M, a3.M);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ me_0(fg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        me_0 a6;
        me_0 me_02 = a6;
        me_02.b = a2;
        me_02.C = a3;
        a6.M = a4;
        a6.c = a5;
    }
}

