/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.Zc;
import ttw.tradefinder.df_0;
import ttw.tradefinder.fg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.se_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.PD
 */
public class pd_1
implements ItemListener {
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ fg C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ sc_1 b;
    public final /* synthetic */ JCheckBox c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ pd_1(fg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        pd_1 a7;
        pd_1 pd_12 = a7;
        a7.C = a2;
        pd_12.c = a3;
        pd_12.M = a4;
        a7.b = a5;
        a7.A = a6;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        pd_1 a3;
        if (a3.c.isSelected() != ((Zc)a3.M.M).M) {
            ((Zc)a3.M.M).M = a3.c.isSelected();
            pd_1 pd_12 = a3;
            pd_12.b.E(((Zc)pd_12.M.M).M);
            pd_1 pd_13 = a3;
            a3.C.E().E("TTW-ImbalanceTracker", pd_13.A.M, a3.M);
            pd_13.M.E(pf_0.I);
        }
    }
}

