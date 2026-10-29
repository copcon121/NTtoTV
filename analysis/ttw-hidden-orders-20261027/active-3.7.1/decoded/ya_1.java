/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.Ic;
import ttw.tradefinder.Q;
import ttw.tradefinder.dB;
import ttw.tradefinder.ee;

/*
 * Renamed from ttw.tradefinder.YA
 */
public class ya_1
implements ActionListener {
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ dB b;
    public final /* synthetic */ Q c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        ya_1 a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), Ic.b);
        if (a2 != a3.c.E()) {
            ya_1 ya_12 = a3;
            ya_12.c.E((Ic)((Object)a2));
            ya_12.b.c.repaint();
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ya_1(dB a2, JComboBox a3, Q a4) {
        ya_1 a5;
        a5.b = a2;
        a5.M = a3;
        a5.c = a4;
    }
}

