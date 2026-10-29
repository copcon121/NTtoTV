/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.Wa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.lg;
import ttw.tradefinder.vE;
import ttw.tradefinder.ze_2;

public class ZD
implements ActionListener {
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ String C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ lg b;
    public final /* synthetic */ JComboBox c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ZD(lg a2, JComboBox a3, df_0 a4, ze_2 a5, String a6) {
        ZD a7;
        ZD zD = a7;
        a7.b = a2;
        zD.c = a3;
        zD.M = a4;
        a7.A = a5;
        a7.C = a6;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        ZD a3;
        a2 = ee.E(a3.c.getSelectedItem().toString(), df_1.b);
        if (a2 != ((Wa)a3.M.M).c) {
            ((Wa)a3.M.M).c = a2;
            ZD zD = a3;
            a3.b.E().E("TTW-MarketExplorer", a3.A.M, zD.C, zD.M);
        }
    }
}

