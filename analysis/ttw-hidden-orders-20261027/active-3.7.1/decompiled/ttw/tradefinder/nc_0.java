/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.ba_0;
import ttw.tradefinder.cC;
import ttw.tradefinder.ee;
import ttw.tradefinder.s;

/*
 * Renamed from ttw.tradefinder.nc
 */
public class nc_0
implements ActionListener {
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ ba_0 b;
    public final /* synthetic */ s c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        nc_0 a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), cC.c);
        if (a2 != a3.c.E()) {
            nc_0 nc_02 = a3;
            nc_02.c.E((cC)((Object)a2));
            nc_02.b.c.repaint();
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ nc_0(ba_0 a2, JComboBox a3, s a4) {
        nc_0 a5;
        a5.b = a2;
        a5.M = a3;
        a5.c = a4;
    }
}

