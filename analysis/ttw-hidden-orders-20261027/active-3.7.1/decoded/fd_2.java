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
import ttw.tradefinder.lg;
import ttw.tradefinder.se_1;
import ttw.tradefinder.ua;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.fD
 */
public class fd_2
implements ActionListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ lg M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ JComboBox c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ fd_2(lg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        fd_2 a6;
        fd_2 fd_22 = a6;
        fd_22.M = a2;
        fd_22.c = a3;
        a6.C = a4;
        a6.b = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        fd_2 a3;
        a2 = ee.E(a3.c.getSelectedItem().toString(), df_1.b);
        if (a2 != ((ua)a3.C.M).b) {
            ((ua)a3.C.M).b = a2;
            a3.M.E().E("TTW-MarketExplorer", a3.b.M, a3.C);
        }
    }
}

