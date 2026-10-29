/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Frame;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JFrame;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.dd;
import ttw.tradefinder.md_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Uc
 */
public class uc_1
implements ActionListener {
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ bb_1 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        uc_1 a3;
        a2 = a3.c.C;
        synchronized (a2) {
            if (a3.c.b.containsKey(a3.b.M)) {
                md_0 md_02 = a3.c.b.get(a3.b.M);
                md_02.setVisible(true);
                md_02.toFront();
                return;
            }
        }
        a2 = new JFrame();
        ((Window)a2).setType(Window.Type.UTILITY);
        ((Frame)a2).setUndecorated(true);
        uc_1 uc_12 = a3;
        md_0 md_03 = new md_0(a3.c.E().f(), uc_12.b, uc_12.c.E(), (JFrame)a2);
        Object object = a3.c.C;
        synchronized (object) {
            a3.c.b.put(a3.b.M, md_03);
            md_0 md_04 = md_03;
            md_04.addComponentListener(new dd(a3));
            md_04.setVisible(true);
            md_04.toFront();
            return;
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ uc_1(bb_1 a2, ze_2 a3) {
        uc_1 a4;
        a4.c = a2;
        a4.b = a3;
    }
}

