/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.lg;
import ttw.tradefinder.ra;
import ttw.tradefinder.ze_2;

public class TE
implements ActionListener {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ lg b;
    public final /* synthetic */ df_0 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        TE a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), df_1.b);
        if (a2 != ((ra)a3.c.M).D) {
            ((ra)a3.c.M).D = a2;
            a3.b.E().E("TTW-MarketExplorer", a3.C.M, a3.c);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ TE(lg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        TE a6;
        TE tE = a6;
        tE.b = a2;
        tE.M = a3;
        a6.c = a4;
        a6.C = a5;
    }
}

