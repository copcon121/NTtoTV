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
import ttw.tradefinder.wd_2;
import ttw.tradefinder.ze_2;

public class Dg
implements ActionListener {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ fg b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Dg(fg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        Dg a6;
        Dg dg = a6;
        dg.b = a2;
        dg.M = a3;
        a6.c = a4;
        a6.C = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        Dg a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), df_1.b);
        if (a2 != ((Zc)a3.c.M).h) {
            ((Zc)a3.c.M).h = a2;
            a3.b.E().E("TTW-ImbalanceTracker", a3.C.M, a3.c);
        }
    }
}

