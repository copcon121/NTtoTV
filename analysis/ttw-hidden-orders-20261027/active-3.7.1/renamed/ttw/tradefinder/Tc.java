/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.ba_0;
import ttw.tradefinder.db_0;
import ttw.tradefinder.ic_0;
import ttw.tradefinder.s;

public class Tc
implements ChangeListener {
    public final /* synthetic */ ba_0 b;
    public final /* synthetic */ s c;

    @Override
    public void stateChanged(ChangeEvent a22) {
        Tc a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        db_0 db_02 = a22 % 2 == 0 ? db_0.b : db_0.c;
        ic_0 ic_02 = a22 = a22 / 2 == 0 ? ic_0.b : ic_0.M;
        if (db_02 != a3.c.ttw_tradefinder_db_0_E() || a22 != a3.c.ttw_tradefinder_ic_0_E()) {
            Tc tc = a3;
            tc.c.E(db_02);
            tc.c.E(a22);
            tc.b.c.repaint();
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Tc(ba_0 a2, s a3) {
        Tc a4;
        a4.b = a2;
        a4.c = a3;
    }
}

