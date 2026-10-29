/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.FocusEvent;
import java.awt.event.FocusListener;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JPasswordField;
import ttw.tradefinder.af_2;
import ttw.tradefinder.if_0;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.zc_2;

/*
 * Renamed from ttw.tradefinder.pb
 */
public class pb_1
implements FocusListener {
    public final /* synthetic */ JButton M;
    public final /* synthetic */ qc_1 b;
    public final /* synthetic */ JPasswordField c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ pb_1(qc_1 a2, JPasswordField a3, JButton a4) {
        pb_1 a5;
        a5.b = a2;
        a5.c = a3;
        a5.M = a4;
    }

    @Override
    public /* synthetic */ void focusLost(FocusEvent a2) {
        pb_1 pb_12;
        pb_1 a3;
        a2 = String.valueOf(a3.c.getPassword());
        a2 = ((String)a2).trim();
        if (!((String)a2).matches(if_0.E("E\u000eZxA46/+x\"\t6\b`f)(?"))) {
            a3.b.j(af_2.E("\u0019a\u0001}\t3\b|\u001c~\u000fgN|\b3\u0002z\rv\u0000`\u000b3\u0007w"));
            a3.b.B = true;
            return;
        }
        pb_1 pb_13 = a3;
        if (!((String)a2).equals(a3.b.a())) {
            pb_13.b.E((String)a2);
            pb_1 pb_14 = a3;
            pb_12 = pb_14;
            pb_14.b.d();
        } else {
            if (pb_13.b.B) {
                pb_1 pb_15 = a3;
                pb_15.b.j(zc_2.E(pb_15.b.E()));
            }
            pb_12 = a3;
        }
        pb_12.b.B = false;
    }

    @Override
    public /* synthetic */ void focusGained(FocusEvent a22) {
        pb_1 a3;
        boolean a22 = a3.c.getEchoChar() == '*';
        if (!a22) {
            return;
        }
        pb_1 pb_12 = a3;
        pb_12.M.setIcon(new ImageIcon(a3.b.E));
        pb_12.c.setEchoChar('\u0000');
    }
}

