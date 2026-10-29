/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import javax.swing.BorderFactory;
import javax.swing.JPasswordField;
import ttw.tradefinder.df_0;
import ttw.tradefinder.jA;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.wf_2;

/*
 * Renamed from ttw.tradefinder.Of
 */
public class of_2
implements KeyListener {
    public final /* synthetic */ JPasswordField M;
    public final /* synthetic */ wf_2 b;
    public final /* synthetic */ df_0 c;

    @Override
    public void keyReleased(KeyEvent a2) {
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ of_2(wf_2 a2, JPasswordField a3, df_0 a4) {
        of_2 a5;
        a5.b = a2;
        a5.M = a3;
        a5.c = a4;
    }

    @Override
    public void keyTyped(KeyEvent a2) {
    }

    @Override
    public void keyPressed(KeyEvent a2) {
        if (((KeyEvent)a2).getKeyCode() == 10) {
            of_2 a3;
            a2 = String.valueOf(a3.M.getPassword());
            if (!((String)(a2 = ((String)a2).trim())).matches(wa_2.E("fB\b4\u0001DC,\u0014(\rd\u0002BY4BX\u0015C\b4\u0001F\u0015DC*\b5\f)E="))) {
                a3.M.setBorder(BorderFactory.createLineBorder(Color.red, 2));
                return;
            }
            a3.M.setBorder(BorderFactory.createEmptyBorder());
            of_2 of_22 = a3;
            if (!((String)a2).equals(of_22.b.E(((jA)of_22.c.M).C))) {
                ((jA)a3.c.M).C = a3.b.j((String)a2);
                of_2 of_23 = a3;
                a3.b.A.E(of_23.c);
                of_23.c.E(pf_0.T);
            }
        }
    }
}

