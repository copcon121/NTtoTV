/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import ttw.tradefinder.of_0;
import ttw.tradefinder.te_1;

/*
 * Renamed from ttw.tradefinder.Be
 */
public class be_1
implements ItemListener {
    public final /* synthetic */ of_0 c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        be_1 a3;
        if (a3.c.h.isSelected()) {
            a3.c.a.E(te_1.A);
        }
    }

    public /* synthetic */ be_1(of_0 a2) {
        be_1 a3;
        a3.c = a2;
    }
}

