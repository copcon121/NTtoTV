/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Dialog;
import java.awt.Window;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import javax.swing.SwingUtilities;
import ttw.tradefinder.nc_2;
import ttw.tradefinder.wc_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.rd
 */
public class rd_0
extends ComponentAdapter {
    public final /* synthetic */ wc_1 b;
    public final /* synthetic */ nc_2 c;

    public /* synthetic */ rd_0(nc_2 a2, wc_1 a3) {
        rd_0 a4;
        a4.c = a2;
        a4.b = a3;
    }

    @Override
    public void componentHidden(ComponentEvent a2) {
        rd_0 a3;
        rd_0 rd_02 = a3;
        rd_02.b.d();
        SwingUtilities.invokeLater(() -> {
            rd_0 a3;
            Object object = a3.c.c.M;
            synchronized (object) {
                if (a3.c.c.C.containsKey(((ze_2)a2).M)) {
                    rd_02.c.C = a3.c.c.C.remove(((ze_2)a2).M);
                    ((Dialog)((Object)rd_02.c.C)).setVisible(false);
                    ((Window)((Object)rd_02.c.C)).dispose();
                }
                return;
            }
        });
    }
}

