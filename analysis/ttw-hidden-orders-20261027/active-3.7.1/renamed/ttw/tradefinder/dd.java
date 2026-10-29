/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Dialog;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import javax.swing.SwingUtilities;
import ttw.tradefinder.md_0;
import ttw.tradefinder.uc_1;
import ttw.tradefinder.ze_2;

public class dd
extends ComponentAdapter {
    public final /* synthetic */ uc_1 c;

    public /* synthetic */ dd(uc_1 a2) {
        dd a3;
        a3.c = a2;
    }

    @Override
    public void componentHidden(ComponentEvent a2) {
        dd a3;
        dd dd2 = a3;
        SwingUtilities.invokeLater(() -> {
            dd a3;
            Object object = a3.c.c.C;
            synchronized (object) {
                if (a3.c.c.b.containsKey(((ze_2)a2).M)) {
                    dd2.c.b = a3.c.c.b.remove(((ze_2)a2).M);
                    ((Dialog)((Object)dd2.c.b)).setVisible(false);
                    ((md_0)((Object)dd2.c.b)).E();
                }
                return;
            }
        });
    }
}

