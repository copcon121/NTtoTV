/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JOptionPane;
import ttw.tradefinder.id_2;

/*
 * Renamed from ttw.tradefinder.mD
 */
public class md_2
implements ActionListener {
    public final /* synthetic */ String A;
    public final /* synthetic */ JButton C;
    public final /* synthetic */ String M;
    public final /* synthetic */ id_2 b;
    public final /* synthetic */ String c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ md_2(id_2 a2, JButton a3, String a4, String a5, String a6) {
        md_2 a7;
        md_2 md_22 = a7;
        a7.b = a2;
        md_22.C = a3;
        md_22.c = a4;
        a7.M = a5;
        a7.A = a6;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        md_2 a3;
        md_2 md_22 = a3;
        md_2 md_23 = a3;
        JOptionPane.showMessageDialog(md_22.C, md_22.b.c.get(a3.c), md_23.M + ", " + md_23.A, -1, new ImageIcon(id_2.M));
    }
}

