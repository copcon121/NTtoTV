/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.P;
import ttw.tradefinder.fa_1;

/*
 * Renamed from ttw.tradefinder.Eb
 */
public class eb_2
implements ChangeListener {
    public final /* synthetic */ fa_1 b;
    public final /* synthetic */ P c;

    @Override
    public void stateChanged(ChangeEvent a22) {
        eb_2 a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        if (a22 != a3.c.int_E()) {
            eb_2 eb_22 = a3;
            eb_22.c.E(a22);
            eb_22.b.a(a3.c);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ eb_2(fa_1 a2, P a3) {
        eb_2 a4;
        a4.b = a2;
        a4.c = a3;
    }
}

