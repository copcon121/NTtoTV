/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.ImageIcon;
import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.ca_1;
import ttw.tradefinder.cb_0;
import ttw.tradefinder.ta_1;
import ttw.tradefinder.z;

public class hB
implements ChangeListener {
    public final /* synthetic */ z b;
    public final /* synthetic */ ta_1 c;

    @Override
    public void stateChanged(ChangeEvent a22) {
        hB a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        if (a22 != a3.b.int_E()) {
            hB hB2 = a3;
            hB2.b.a(a22);
            hB2.c.M.setIcon(new ImageIcon(cb_0.E(new ca_1(a3.b))));
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ hB(ta_1 a2, z a3) {
        hB a4;
        a4.c = a2;
        a4.b = a3;
    }
}

