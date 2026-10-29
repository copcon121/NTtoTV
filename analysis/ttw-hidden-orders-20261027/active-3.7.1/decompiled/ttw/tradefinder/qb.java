/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.Q;
import ttw.tradefinder.dB;
import ttw.tradefinder.ee;
import ttw.tradefinder.lc_0;

public class qb
implements ActionListener {
    public final /* synthetic */ dB M;
    public final /* synthetic */ Q b;
    public final /* synthetic */ JComboBox c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ qb(dB a2, JComboBox a3, Q a4) {
        qb a5;
        a5.M = a2;
        a5.c = a3;
        a5.b = a4;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        qb a3;
        a2 = ee.E(a3.c.getSelectedItem().toString(), lc_0.C);
        if (a2 != a3.b.E()) {
            qb qb2 = a3;
            qb2.b.E((lc_0)((Object)a2));
            qb2.M.c.repaint();
        }
    }
}

