/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import javax.swing.JTextField;
import ttw.tradefinder.na_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sa_1;

/*
 * Renamed from ttw.tradefinder.bd
 */
public class bd_0
implements KeyListener {
    public final /* synthetic */ na_0 M;
    public final /* synthetic */ sa_1 b;
    public final /* synthetic */ JTextField c;

    @Override
    public void keyPressed(KeyEvent a2) {
        if (((KeyEvent)a2).getKeyCode() == 10) {
            bd_0 a3;
            a2 = a3.c.getText();
            if (!((String)(a2 = ((String)a2).trim())).equals(a3.M.b)) {
                bd_0 bd_02 = a3;
                bd_02.M.b = a2;
                bd_0 bd_03 = a3;
                bd_02.b.c.E(a3.b.b, bd_03.b.C.M, a3.b.M);
                bd_03.b.M.E(pf_0.r);
                bd_02.b.c.E();
            }
        }
    }

    @Override
    public void keyReleased(KeyEvent a2) {
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ bd_0(sa_1 a2, JTextField a3, na_0 a4) {
        bd_0 a5;
        a5.b = a2;
        a5.c = a3;
        a5.M = a4;
    }

    @Override
    public void keyTyped(KeyEvent a2) {
    }
}

