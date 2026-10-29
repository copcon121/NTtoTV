/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.LC;
import ttw.tradefinder.df_0;
import ttw.tradefinder.oc_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.pd
 */
public class pd_0
implements ItemListener {
    public final /* synthetic */ JCheckBox A;
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ sc_1 b;
    public final /* synthetic */ oc_1 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ pd_0(oc_1 a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        pd_0 a7;
        pd_0 pd_02 = a7;
        a7.c = a2;
        pd_02.A = a3;
        pd_02.M = a4;
        a7.b = a5;
        a7.C = a6;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        pd_0 a3;
        if (a3.A.isSelected() != ((LC)a3.M.M).M) {
            ((LC)a3.M.M).M = a3.A.isSelected();
            pd_0 pd_02 = a3;
            pd_02.b.E(((LC)pd_02.M.M).M);
            pd_0 pd_03 = a3;
            a3.c.E().E(a3.c.E().f(), pd_03.C.M, a3.M);
            pd_03.M.E(pf_0.V);
        }
    }
}

