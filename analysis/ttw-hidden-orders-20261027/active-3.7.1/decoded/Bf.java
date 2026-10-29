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
import ttw.tradefinder.if_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pa_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

public class Bf
implements ActionListener {
    public final /* synthetic */ lg C;
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        Bf a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), df_1.b);
        if (a2 != ((pa_0)a3.b.M).h) {
            ((pa_0)a3.b.M).h = a2;
            Bf bf = a3;
            a3.C.E().E("TTW-MarketExplorer", bf.c.M, a3.b);
            bf.b.E(pf_0.ga);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Bf(lg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        Bf a6;
        Bf bf = a6;
        bf.C = a2;
        bf.M = a3;
        a6.b = a4;
        a6.c = a5;
    }
}

