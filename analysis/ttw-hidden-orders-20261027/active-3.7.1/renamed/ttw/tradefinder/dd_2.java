/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import ttw.tradefinder.of_0;
import ttw.tradefinder.te_1;

/*
 * Renamed from ttw.tradefinder.dD
 */
public class dd_2
implements ItemListener {
    public final /* synthetic */ of_0 c;

    public /* synthetic */ dd_2(of_0 a2) {
        dd_2 a3;
        a3.c = a2;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        dd_2 a3;
        if (a3.c.D.isSelected()) {
            a3.c.a.E(te_1.D);
        }
    }
}

