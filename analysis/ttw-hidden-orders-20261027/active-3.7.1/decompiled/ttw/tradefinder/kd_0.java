/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.na_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Kd
 */
public class kd_0
implements ItemListener {
    public final /* synthetic */ na_0 A;
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ JCheckBox b;
    public final /* synthetic */ bb_1 c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        kd_0 a3;
        if (a3.b.isSelected() != a3.A.C) {
            kd_0 kd_02 = a3;
            kd_0 kd_03 = a3;
            kd_02.A.C = kd_03.b.isSelected();
            kd_02.c.E().E(a3.c.E().f(), a3.C.M, a3.M);
            kd_03.M.E(pf_0.r);
            kd_02.c.l(a3.C.M);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ kd_0(bb_1 a2, JCheckBox a3, na_0 a4, ze_2 a5, df_0 a6) {
        kd_0 a7;
        kd_0 kd_02 = a7;
        a7.c = a2;
        kd_02.b = a3;
        kd_02.A = a4;
        a7.C = a5;
        a7.M = a6;
    }
}

