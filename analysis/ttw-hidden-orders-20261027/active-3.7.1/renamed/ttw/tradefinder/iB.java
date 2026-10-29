/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.n;
import ttw.tradefinder.sB;

public class iB
implements ChangeListener {
    public final /* synthetic */ n b;
    public final /* synthetic */ sB c;

    @Override
    public void stateChanged(ChangeEvent a22) {
        iB a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        if (a22 != a3.b.int_E()) {
            iB iB2 = a3;
            iB2.b.E(a22);
            iB2.c.c.repaint();
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ iB(sB a2, n a3) {
        iB a4;
        a4.c = a2;
        a4.b = a3;
    }
}

