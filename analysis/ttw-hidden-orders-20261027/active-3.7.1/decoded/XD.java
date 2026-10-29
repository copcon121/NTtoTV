/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.Ob;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.gc_1;
import ttw.tradefinder.lg;
import ttw.tradefinder.ze_2;

public class XD
implements ActionListener {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ JComboBox b;
    public final /* synthetic */ lg c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ XD(lg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        XD a6;
        XD xD = a6;
        xD.c = a2;
        xD.b = a3;
        a6.M = a4;
        a6.C = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        XD a3;
        a2 = ee.E(a3.b.getSelectedItem().toString(), df_1.b);
        if (a2 != ((Ob)a3.M.M).h) {
            ((Ob)a3.M.M).h = a2;
            a3.c.E().E("TTW-MarketExplorer", a3.C.M, a3.M);
        }
    }
}

