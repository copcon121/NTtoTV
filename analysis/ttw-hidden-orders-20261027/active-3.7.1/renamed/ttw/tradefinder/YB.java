/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Q;
import ttw.tradefinder.dB;

public class YB
implements ChangeListener {
    public final /* synthetic */ Q b;
    public final /* synthetic */ dB c;

    @Override
    public void stateChanged(ChangeEvent a22) {
        YB a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        if (a22 != a3.b.int_E()) {
            YB yB = a3;
            yB.b.E(a22);
            yB.c.c.repaint();
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ YB(dB a2, Q a3) {
        YB a4;
        a4.c = a2;
        a4.b = a3;
    }
}

