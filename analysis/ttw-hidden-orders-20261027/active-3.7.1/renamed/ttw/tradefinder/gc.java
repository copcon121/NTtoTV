/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.ba_0;
import ttw.tradefinder.s;

public class gc
implements ChangeListener {
    public final /* synthetic */ s b;
    public final /* synthetic */ ba_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ gc(ba_0 a2, s a3) {
        gc a4;
        a4.c = a2;
        a4.b = a3;
    }

    @Override
    public void stateChanged(ChangeEvent a22) {
        gc a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        if (a22 != a3.b.a()) {
            gc gc2 = a3;
            gc2.b.j(a22);
            gc2.c.c.repaint();
        }
    }
}

