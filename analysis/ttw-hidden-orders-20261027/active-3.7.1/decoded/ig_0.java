/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.of_0;

/*
 * Renamed from ttw.tradefinder.ig
 */
public class ig_0
implements ItemListener {
    public final /* synthetic */ JCheckBox b;
    public final /* synthetic */ of_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ig_0(of_0 a2, JCheckBox a3) {
        ig_0 a4;
        a4.c = a2;
        a4.b = a3;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        ig_0 a3;
        if (a3.b.isSelected() != a3.c.a.E()) {
            ig_0 ig_02 = a3;
            a3.c.a.E(ig_02.b.isSelected());
            ig_02.c.H();
        }
    }
}

