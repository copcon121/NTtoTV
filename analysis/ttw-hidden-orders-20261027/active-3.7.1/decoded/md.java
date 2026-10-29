/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.ba_0;
import ttw.tradefinder.s;
import ttw.tradefinder.wB;

public class md
implements ChangeListener {
    public final /* synthetic */ ba_0 M;
    public final /* synthetic */ int b;
    public final /* synthetic */ s c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ md(ba_0 a2, int a3, s a4) {
        md a5;
        a5.M = a2;
        a5.b = a3;
        a5.c = a4;
    }

    @Override
    public void stateChanged(ChangeEvent a22) {
        md a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        wB wB2 = a22 < 0 ? wB.c : wB.M;
        if ((a22 = Math.abs(a22) + a3.b) != a3.c.j()) {
            a3.c.E(a22);
        }
        if (wB2 != a3.c.E()) {
            md md2 = a3;
            md2.c.E(wB2);
            md2.M.c.repaint();
        }
    }
}

