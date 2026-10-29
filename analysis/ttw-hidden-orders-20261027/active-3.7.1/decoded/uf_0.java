/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ff_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ta_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.uF
 */
public class uf_0
implements ItemListener {
    public final /* synthetic */ JCheckBox A;
    public final /* synthetic */ lg C;
    public final /* synthetic */ sc_1 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        uf_0 a3;
        if (a3.A.isSelected() != ((ta_0)a3.b.M).M) {
            ((ta_0)a3.b.M).M = a3.A.isSelected();
            uf_0 uf_02 = a3;
            uf_02.M.E(((ta_0)uf_02.b.M).M);
            uf_0 uf_03 = a3;
            a3.C.E().E("TTW-MarketExplorer", uf_03.c.M, a3.b);
            uf_03.b.E(pf_0.h);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ uf_0(lg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        uf_0 a7;
        uf_0 uf_02 = a7;
        a7.C = a2;
        uf_02.A = a3;
        uf_02.b = a4;
        a7.M = a5;
        a7.c = a6;
    }
}

