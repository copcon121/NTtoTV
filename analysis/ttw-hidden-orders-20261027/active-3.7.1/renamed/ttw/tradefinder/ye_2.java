/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import ttw.tradefinder.of_0;
import ttw.tradefinder.te_1;

/*
 * Renamed from ttw.tradefinder.yE
 */
public class ye_2
implements ItemListener {
    public final /* synthetic */ of_0 c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        ye_2 a3;
        if (a3.c.var_javax_swing_JRadioButton_C.isSelected()) {
            a3.c.a.E(te_1.c);
        }
    }

    public /* synthetic */ ye_2(of_0 a2) {
        ye_2 a3;
        a3.c = a2;
    }
}

