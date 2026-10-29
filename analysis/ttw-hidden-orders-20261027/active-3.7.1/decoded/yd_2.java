/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JPasswordField;
import ttw.tradefinder.wf_2;

/*
 * Renamed from ttw.tradefinder.Yd
 */
public class yd_2
implements ActionListener {
    public final /* synthetic */ wf_2 M;
    public final /* synthetic */ JPasswordField b;
    public final /* synthetic */ JButton c;

    @Override
    public void actionPerformed(ActionEvent a22) {
        yd_2 a3;
        boolean a22 = a3.b.getEchoChar() == '*';
        yd_2 yd_22 = a3;
        a3.c.setIcon(new ImageIcon(a22 ? yd_22.M.M : yd_22.M.C));
        a3.b.setEchoChar(a22 ? (char)'\u0000' : '*');
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ yd_2(wf_2 a2, JPasswordField a3, JButton a4) {
        yd_2 a5;
        a5.M = a2;
        a5.b = a3;
        a5.c = a4;
    }
}

