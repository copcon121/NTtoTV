/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.se_0;
import ttw.tradefinder.ua;
import ttw.tradefinder.ze_2;

public class ie
implements ItemListener {
    public final /* synthetic */ sc_1 A;
    public final /* synthetic */ JCheckBox C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ lg b;
    public final /* synthetic */ df_0 c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        ie a3;
        if (a3.C.isSelected() != ((ua)a3.c.M).C) {
            ((ua)a3.c.M).C = a3.C.isSelected();
            ie ie2 = a3;
            ie2.A.E(((ua)ie2.c.M).C);
            ie ie3 = a3;
            a3.b.E().E("TTW-MarketExplorer", ie3.M.M, a3.c);
            ie3.c.E(pf_0.k);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ie(lg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        ie a7;
        ie ie2 = a7;
        a7.b = a2;
        ie2.C = a3;
        ie2.c = a4;
        a7.A = a5;
        a7.M = a6;
    }
}

