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
 * Renamed from ttw.tradefinder.XC
 */
public class xc_0
implements ChangeListener {
    public final /* synthetic */ ta_1 b;
    public final /* synthetic */ z c;

    @Override
    public void stateChanged(ChangeEvent a22) {
        xc_0 a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        if (a22 != a3.c.int_a()) {
            xc_0 xc_02 = a3;
            xc_02.c.E(a22);
            xc_02.b.M.setIcon(new ImageIcon(cb_0.E(new ca_1(a3.c))));
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ xc_0(ta_1 a2, z a3) {
        xc_0 a4;
        a4.b = a2;
        a4.c = a3;
    }
}

