/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import ttw.tradefinder.wc_1;

/*
 * Renamed from ttw.tradefinder.mC
 */
public class mc_2
implements ItemListener {
    public final /* synthetic */ wc_1 c;

    public /* synthetic */ mc_2(wc_1 a2) {
        mc_2 a3;
        a3.c = a2;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        mc_2 a3;
        mc_2 mc_22 = a3;
        a3.c.E(mc_22.c.c.isSelected());
        mc_22.c.b.a(a3.c.c.isSelected());
    }
}

