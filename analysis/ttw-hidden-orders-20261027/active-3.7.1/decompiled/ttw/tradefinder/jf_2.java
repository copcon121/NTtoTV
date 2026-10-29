/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import ttw.tradefinder.lf_2;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.te_2;

/*
 * Renamed from ttw.tradefinder.JF
 */
public class jf_2
extends MouseAdapter {
    public final /* synthetic */ lf_2 M;
    public final /* synthetic */ te_2 b;
    public final /* synthetic */ sc_1 c;

    @Override
    public void mouseClicked(MouseEvent a2) {
        jf_2 a3;
        if (a2.getX() < 25 && a2.getY() < 25) {
            jf_2 jf_22 = a3;
            jf_22.b.E(jf_22.c.E());
        }
        a3.M.repaint();
    }

    public /* synthetic */ jf_2(lf_2 a2, te_2 a3, sc_1 a4) {
        jf_2 a5;
        a5.M = a2;
        a5.b = a3;
        a5.c = a4;
    }
}

