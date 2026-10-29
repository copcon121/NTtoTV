/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.Wa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.gc_1;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

public class pe
implements ItemListener {
    public final /* synthetic */ sc_1 D;
    public final /* synthetic */ JCheckBox A;
    public final /* synthetic */ lg C;
    public final /* synthetic */ String M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ze_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ pe(lg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6, String a7) {
        pe a8;
        pe pe2 = a8;
        pe pe3 = a8;
        pe3.C = a2;
        pe3.A = a3;
        pe2.b = a4;
        pe2.D = a5;
        a8.c = a6;
        a8.M = a7;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        pe a3;
        if (a3.A.isSelected() != ((Wa)a3.b.M).H) {
            ((Wa)a3.b.M).H = a3.A.isSelected();
            pe pe2 = a3;
            pe2.D.E(((Wa)pe2.b.M).H);
            pe pe3 = a3;
            pe pe4 = a3;
            a3.C.E().E("TTW-MarketExplorer", pe3.c.M, pe4.M, pe4.b);
            pe3.b.E(pf_0.da);
        }
    }
}

