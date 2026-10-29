/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Dialog;
import java.awt.Window;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import javax.swing.SwingUtilities;
import ttw.tradefinder.ma_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.IC
 */
public class ic_2
extends ComponentAdapter {
    public final /* synthetic */ ma_1 c;

    @Override
    public void componentHidden(ComponentEvent a2) {
        ic_2 a3;
        ic_2 ic_22 = a3;
        SwingUtilities.invokeLater(() -> {
            ic_2 a3;
            Object object = a3.c.M.b;
            synchronized (object) {
                if (a3.c.M.M.containsKey(((ze_2)a2).M)) {
                    ic_22.c.b = a3.c.M.M.remove(((ze_2)a2).M);
                    ((Dialog)((Object)ic_22.c.b)).setVisible(false);
                    ((Window)((Object)ic_22.c.b)).dispose();
                }
                return;
            }
        });
    }

    public /* synthetic */ ic_2(ma_1 a2) {
        ic_2 a3;
        a3.c = a2;
    }
}

