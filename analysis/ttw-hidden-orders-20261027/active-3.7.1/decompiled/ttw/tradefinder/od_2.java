/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JButton;
import javax.swing.JOptionPane;
import ttw.tradefinder.gc_1;
import ttw.tradefinder.ja_1;
import ttw.tradefinder.of_0;
import ttw.tradefinder.q_0;

/*
 * Renamed from ttw.tradefinder.OD
 */
public class od_2
implements ActionListener {
    public final /* synthetic */ ja_1 C;
    public final /* synthetic */ JButton M;
    public final /* synthetic */ q_0 b;
    public final /* synthetic */ String c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ od_2(JButton a2, String a3, ja_1 a4, q_0 a5) {
        od_2 a6;
        od_2 od_22 = a6;
        od_22.M = a2;
        od_22.c = a3;
        a6.C = a4;
        a6.b = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        od_2 a3;
        a2 = gc_1.E("a\rG\fVBa\u0007F\u0016[\fU\u0011");
        od_2 od_22 = a3;
        JOptionPane.showMessageDialog(a3.M, new of_0(a3.c, (String)a2, od_22.C, od_22.b.j(), a3.b.E()), (String)a2, -1);
    }
}

