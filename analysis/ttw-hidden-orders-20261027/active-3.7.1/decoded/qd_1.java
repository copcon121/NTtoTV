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
import ttw.tradefinder.qe_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.qD
 */
public class qd_1
implements ActionListener {
    public final /* synthetic */ JComboBox C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ fg c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        qd_1 a3;
        a2 = ee.E(a3.C.getSelectedItem().toString(), df_1.b);
        if (a2 != ((Zc)a3.M.M).K) {
            ((Zc)a3.M.M).K = a2;
            a3.c.E().E("TTW-ImbalanceTracker", a3.b.M, a3.M);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ qd_1(fg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        qd_1 a6;
        qd_1 qd_12 = a6;
        qd_12.c = a2;
        qd_12.C = a3;
        a6.M = a4;
        a6.b = a5;
    }
}

