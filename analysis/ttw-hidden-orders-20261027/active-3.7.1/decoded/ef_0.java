/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.Oc;
import ttw.tradefinder.Zc;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.fg;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.eF
 */
public class ef_0
implements ActionListener {
    public final /* synthetic */ JComboBox C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ fg c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        ef_0 a3;
        a2 = ee.E(a3.C.getSelectedItem().toString(), df_1.b);
        if (a2 != ((Zc)a3.M.M).j) {
            ((Zc)a3.M.M).j = a2;
            a3.c.E().E("TTW-ImbalanceTracker", a3.b.M, a3.M);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ef_0(fg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        ef_0 a6;
        ef_0 ef_02 = a6;
        ef_02.c = a2;
        ef_02.C = a3;
        a6.M = a4;
        a6.b = a5;
    }
}

