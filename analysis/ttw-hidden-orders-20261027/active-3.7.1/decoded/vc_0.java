/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import javax.swing.JTextField;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.na_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Vc
 */
public class vc_0
implements KeyListener {
    public final /* synthetic */ JTextField D;
    public final /* synthetic */ df_0 A;
    public final /* synthetic */ na_0 C;
    public final /* synthetic */ sc_1 M;
    public final /* synthetic */ bb_1 b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void keyPressed(KeyEvent a2) {
        if (((KeyEvent)a2).getKeyCode() == 10) {
            vc_0 a3;
            a2 = a3.D.getText();
            if (!((String)(a2 = ((String)a2).trim())).equals(a3.C.b)) {
                vc_0 vc_02 = a3;
                vc_02.C.b = a2;
                vc_0 vc_03 = a3;
                vc_02.b.E().E(a3.b.E().f(), vc_03.c.M, a3.A);
                vc_03.A.E(pf_0.r);
                vc_02.M.E(a3.b.E() + " - " + a3.C.b);
                vc_0 vc_04 = a3;
                vc_04.b.l(vc_04.c.M);
            }
        }
    }

    @Override
    public void keyReleased(KeyEvent a2) {
    }

    @Override
    public void keyTyped(KeyEvent a2) {
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ vc_0(bb_1 a2, JTextField a3, na_0 a4, ze_2 a5, df_0 a6, sc_1 a7) {
        vc_0 a8;
        vc_0 vc_02 = a8;
        vc_0 vc_03 = a8;
        vc_03.b = a2;
        vc_03.D = a3;
        vc_02.C = a4;
        vc_02.c = a5;
        a8.A = a6;
        a8.M = a7;
    }
}

