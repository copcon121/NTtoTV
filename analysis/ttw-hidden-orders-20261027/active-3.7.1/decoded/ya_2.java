/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JButton;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.na_0;
import ttw.tradefinder.oa_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.yA
 */
public class ya_2
implements ActionListener {
    public final /* synthetic */ int h;
    public final /* synthetic */ ze_2 H;
    public final /* synthetic */ df_0 D;
    public final /* synthetic */ JButton A;
    public final /* synthetic */ sc_1 C;
    public final /* synthetic */ bb_1 M;
    public final /* synthetic */ na_0 b;
    public final /* synthetic */ sc_1 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ya_2(bb_1 a2, na_0 a3, df_0 a4, int a5, ze_2 a6, sc_1 a7, JButton a8, sc_1 a9) {
        ya_2 a10;
        ya_2 ya_22 = a10;
        ya_2 ya_23 = a10;
        ya_2 ya_24 = a10;
        ya_24.M = a2;
        ya_24.b = a3;
        ya_23.D = a4;
        ya_23.h = a5;
        ya_22.H = a6;
        ya_22.C = a7;
        a10.A = a8;
        a10.c = a9;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        ya_2 a3;
        ya_2 ya_22 = a3;
        a2 = ya_22.b.E();
        int n2 = ((oa_0)ya_22.D.M).E((na_0)a2, a3.h);
        ya_2 ya_23 = a3;
        ya_2 ya_24 = a3;
        ya_23.M.E().E(ya_24.M.E().f(), a3.H.M, a3.D);
        ya_23.D.E(pf_0.r);
        if (((oa_0)ya_24.D.M).E() >= bb_1.M) {
            ya_2 ya_25 = a3;
            a3.C.E(ya_25.A);
            ya_25.A.setEnabled(false);
        }
        ya_2 ya_26 = a3;
        ya_2 ya_27 = a3;
        ya_2 ya_28 = a3;
        ya_26.c.E(ya_26.C, ya_27.M.E(ya_27.H, n2, (na_0)a2, ya_28.C, ya_28.c, a3.D));
        ya_26.M.l(a3.H.M);
    }
}

