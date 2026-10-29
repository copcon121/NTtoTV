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
import ttw.tradefinder.go;
import ttw.tradefinder.lg;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Uf
 */
public class uf_2
implements ActionListener {
    public final /* synthetic */ JComboBox C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ lg c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        uf_2 a3;
        a2 = ee.E(a3.C.getSelectedItem().toString(), df_1.b);
        if (a2 != ((Ob)a3.M.M).C) {
            ((Ob)a3.M.M).C = a2;
            a3.c.E().E("TTW-MarketExplorer", a3.b.M, a3.M);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ uf_2(lg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        uf_2 a6;
        uf_2 uf_22 = a6;
        uf_22.c = a2;
        uf_22.C = a3;
        a6.M = a4;
        a6.b = a5;
    }
}

