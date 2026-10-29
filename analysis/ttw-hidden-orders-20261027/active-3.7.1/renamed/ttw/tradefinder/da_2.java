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

/*
 * Renamed from ttw.tradefinder.dA
 */
public class da_2
implements ChangeListener {
    public final /* synthetic */ z b;
    public final /* synthetic */ ta_1 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ da_2(ta_1 a2, z a3) {
        da_2 a4;
        a4.c = a2;
        a4.b = a3;
    }

    @Override
    public void stateChanged(ChangeEvent a22) {
        da_2 a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        if (a22 != a3.b.int_j()) {
            da_2 da_22 = a3;
            da_22.b.j(a22);
            da_22.c.M.setIcon(new ImageIcon(cb_0.E(new ca_1(a3.b))));
        }
    }
}

