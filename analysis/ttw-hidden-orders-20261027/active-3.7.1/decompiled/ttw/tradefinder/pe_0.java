/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pa_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.qe_2;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Pe
 */
public class pe_0
implements ItemListener {
    public final /* synthetic */ df_0 A;
    public final /* synthetic */ lg C;
    public final /* synthetic */ sc_1 M;
    public final /* synthetic */ JCheckBox b;
    public final /* synthetic */ ze_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ pe_0(lg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        pe_0 a7;
        pe_0 pe_02 = a7;
        a7.C = a2;
        pe_02.b = a3;
        pe_02.A = a4;
        a7.M = a5;
        a7.c = a6;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        pe_0 a3;
        if (a3.b.isSelected() != ((pa_0)a3.A.M).M) {
            ((pa_0)a3.A.M).M = a3.b.isSelected();
            pe_0 pe_02 = a3;
            pe_02.M.E(((pa_0)pe_02.A.M).M);
            pe_0 pe_03 = a3;
            a3.C.E().E(qe_2.E("^[]\"Gnxdo{Owzce}o}"), pe_03.c.M, a3.A);
            pe_03.A.E(pf_0.K);
        }
    }
}

