/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.na_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sa_1;

/*
 * Renamed from ttw.tradefinder.MB
 */
public class mb_0
implements ItemListener {
    public final /* synthetic */ JCheckBox M;
    public final /* synthetic */ na_0 b;
    public final /* synthetic */ sa_1 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ mb_0(sa_1 a2, JCheckBox a3, na_0 a4) {
        mb_0 a5;
        a5.c = a2;
        a5.M = a3;
        a5.b = a4;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        mb_0 a3;
        if (a3.M.isSelected() != a3.b.C) {
            mb_0 mb_02 = a3;
            mb_0 mb_03 = a3;
            mb_02.b.C = mb_03.M.isSelected();
            mb_02.c.c.E(a3.c.b, a3.c.var_ttw_tradefinder_ze_2_C.M, a3.c.M);
            mb_03.c.M.E(pf_0.r);
            mb_02.c.c.void_E();
        }
    }
}

