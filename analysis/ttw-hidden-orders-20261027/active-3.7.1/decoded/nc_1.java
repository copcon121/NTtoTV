/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.eb_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.n;
import ttw.tradefinder.sB;

/*
 * Renamed from ttw.tradefinder.nC
 */
public class nc_1
implements ActionListener {
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ sB b;
    public final /* synthetic */ n c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ nc_1(sB a2, JComboBox a3, n a4) {
        nc_1 a5;
        a5.b = a2;
        a5.M = a3;
        a5.c = a4;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        nc_1 a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), eb_1.M);
        if (a2 != a3.c.E()) {
            nc_1 nc_12 = a3;
            nc_12.c.E((eb_1)((Object)a2));
            nc_12.b.c.repaint();
        }
    }
}

