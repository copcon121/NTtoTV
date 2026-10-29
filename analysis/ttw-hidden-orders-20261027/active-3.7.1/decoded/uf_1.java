/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.af_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.xa_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.UF
 */
public class uf_1
implements ItemListener {
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ sc_1 C;
    public final /* synthetic */ lg M;
    public final /* synthetic */ JCheckBox b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ uf_1(lg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        uf_1 a7;
        uf_1 uf_12 = a7;
        a7.M = a2;
        uf_12.b = a3;
        uf_12.c = a4;
        a7.C = a5;
        a7.A = a6;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        uf_1 a3;
        if (a3.b.isSelected() != ((xa_0)a3.c.M).D) {
            ((xa_0)a3.c.M).D = a3.b.isSelected();
            uf_1 uf_12 = a3;
            uf_12.C.E(((xa_0)uf_12.c.M).D);
            uf_1 uf_13 = a3;
            a3.M.E().E("TTW-MarketExplorer", uf_13.A.M, a3.c);
            uf_13.c.E(pf_0.N);
        }
    }
}

