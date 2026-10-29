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
 * Renamed from ttw.tradefinder.Qd
 */
public class qd_0
implements ActionListener {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ ob_1 b;
    public final /* synthetic */ JComboBox c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ qd_0(ob_1 a2, JComboBox a3, df_0 a4, ze_2 a5) {
        qd_0 a6;
        qd_0 qd_02 = a6;
        qd_02.b = a2;
        qd_02.c = a3;
        a6.M = a4;
        a6.C = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        qd_0 a3;
        a2 = ee.E(a3.c.getSelectedItem().toString(), df_1.b);
        if (a2 != ((ua_0)a3.M.M).h) {
            ((ua_0)a3.M.M).h = a2;
            a3.b.E().E(a3.b.E().f(), a3.C.M, a3.M);
        }
    }
}

