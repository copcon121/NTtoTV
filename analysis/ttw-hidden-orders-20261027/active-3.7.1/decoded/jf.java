/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.KB;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.lg;
import ttw.tradefinder.pa_0;
import ttw.tradefinder.ze_2;

public class jf
implements ActionListener {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ lg b;
    public final /* synthetic */ JComboBox c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ jf(lg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        jf a6;
        jf jf2 = a6;
        jf2.b = a2;
        jf2.c = a3;
        a6.M = a4;
        a6.C = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        jf a3;
        a2 = ee.E(a3.c.getSelectedItem().toString(), df_1.b);
        if (a2 != ((pa_0)a3.M.M).A) {
            ((pa_0)a3.M.M).A = a2;
            a3.b.E().E("TTW-MarketExplorer", a3.C.M, a3.M);
        }
    }
}

