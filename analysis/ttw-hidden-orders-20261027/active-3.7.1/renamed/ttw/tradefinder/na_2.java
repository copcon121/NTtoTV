/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.FocusEvent;
import java.awt.event.FocusListener;
import javax.swing.JTextField;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.na_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.NA
 */
public class na_2
implements FocusListener {
    public final /* synthetic */ na_0 D;
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ sc_1 M;
    public final /* synthetic */ JTextField b;
    public final /* synthetic */ bb_1 c;

    @Override
    public void focusGained(FocusEvent a2) {
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ na_2(bb_1 a2, JTextField a3, na_0 a4, ze_2 a5, df_0 a6, sc_1 a7) {
        na_2 a8;
        na_2 na_22 = a8;
        na_2 na_23 = a8;
        na_23.c = a2;
        na_23.b = a3;
        na_22.D = a4;
        na_22.A = a5;
        a8.C = a6;
        a8.M = a7;
    }

    @Override
    public void focusLost(FocusEvent a2) {
        na_2 a3;
        a2 = a3.b.getText();
        if (!((String)(a2 = ((String)a2).trim())).equals(a3.D.b)) {
            na_2 na_22 = a3;
            na_22.D.b = a2;
            na_2 na_23 = a3;
            na_22.c.ttw_tradefinder_f_0_E().E(a3.c.ttw_tradefinder_r_0_E().f(), na_23.A.M, a3.C);
            na_23.C.E(pf_0.r);
            na_22.M.void_E(a3.c.java_lang_String_E() + " - " + a3.D.b);
            na_2 na_24 = a3;
            na_24.c.l(na_24.A.M);
        }
    }
}

