/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.ac_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ta_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.xE
 */
public class xe_0
implements ItemListener {
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ JCheckBox M;
    public final /* synthetic */ sc_1 b;
    public final /* synthetic */ lg c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        xe_0 a3;
        if (a3.M.isSelected() != ((ta_0)a3.C.M).c) {
            ((ta_0)a3.C.M).c = a3.M.isSelected();
            xe_0 xe_02 = a3;
            xe_02.b.E(((ta_0)xe_02.C.M).c);
            xe_0 xe_03 = a3;
            a3.c.ttw_tradefinder_f_0_E().E(ac_2.E("@6COY\u0003f\tq\u0016Q\u001ad\u000e{\u0010q\u0010"), xe_03.A.M, a3.C);
            xe_03.C.E(pf_0.h);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ xe_0(lg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        xe_0 a7;
        xe_0 xe_02 = a7;
        a7.c = a2;
        xe_02.M = a3;
        xe_02.C = a4;
        a7.b = a5;
        a7.A = a6;
    }
}

