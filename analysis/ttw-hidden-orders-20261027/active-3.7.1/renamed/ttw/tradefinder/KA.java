/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.ba_0;
import ttw.tradefinder.s;

public class KA
implements ChangeListener {
    public final /* synthetic */ ba_0 b;
    public final /* synthetic */ s c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ KA(ba_0 a2, s a3) {
        KA a4;
        a4.b = a2;
        a4.c = a3;
    }

    @Override
    public void stateChanged(ChangeEvent a22) {
        KA a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        if (a22 != a3.c.int_E()) {
            KA kA = a3;
            kA.c.a(a22);
            kA.b.c.repaint();
        }
    }
}

