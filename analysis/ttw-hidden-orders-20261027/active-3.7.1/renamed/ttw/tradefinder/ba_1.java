/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import javax.swing.JPasswordField;
import ttw.tradefinder.ae_1;
import ttw.tradefinder.pe_1;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.zc_2;

/*
 * Renamed from ttw.tradefinder.BA
 */
public class ba_1
implements KeyListener {
    public final /* synthetic */ qc_1 b;
    public final /* synthetic */ JPasswordField c;

    @Override
    public /* synthetic */ void keyReleased(KeyEvent a2) {
    }

    @Override
    public /* synthetic */ void keyTyped(KeyEvent a2) {
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ba_1(qc_1 a2, JPasswordField a3) {
        ba_1 a4;
        a4.b = a2;
        a4.c = a3;
    }

    @Override
    public /* synthetic */ void keyPressed(KeyEvent a2) {
        if (((KeyEvent)a2).getKeyCode() == 10) {
            ba_1 ba_12;
            ba_1 a3;
            a2 = String.valueOf(a3.c.getPassword());
            a2 = ((String)a2).trim();
            if (!((String)a2).matches(pe_1.E("\u0001\u0006\u001ep\u0005<r'opf\u0001r\u0000$nm {"))) {
                a3.b.j(ae_1.E("sSkOc\u0001bNvLeU$Nb\u0001hHgDjRa\u0001mE"));
                a3.b.B = true;
                return;
            }
            ba_1 ba_13 = a3;
            if (!((String)a2).equals(a3.b.java_lang_String_a())) {
                ba_13.b.E((String)a2);
                ba_1 ba_14 = a3;
                ba_12 = ba_14;
                ba_14.b.d();
            } else {
                if (ba_13.b.B) {
                    ba_1 ba_15 = a3;
                    ba_15.b.j(zc_2.E(ba_15.b.ttw_tradefinder_cd_E()));
                }
                ba_12 = a3;
            }
            ba_12.b.B = false;
        }
    }
}

