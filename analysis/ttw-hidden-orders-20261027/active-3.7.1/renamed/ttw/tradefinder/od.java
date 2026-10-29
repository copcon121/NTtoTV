/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.FocusEvent;
import java.awt.event.FocusListener;
import javax.swing.JTextField;
import ttw.tradefinder.na_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sa_1;

public class od
implements FocusListener {
    public final /* synthetic */ sa_1 M;
    public final /* synthetic */ JTextField b;
    public final /* synthetic */ na_0 c;

    @Override
    public void focusLost(FocusEvent a2) {
        od a3;
        a2 = a3.b.getText();
        if (!((String)(a2 = ((String)a2).trim())).equals(a3.c.b)) {
            od od2 = a3;
            od2.c.b = a2;
            od od3 = a3;
            od2.M.c.E(a3.M.b, od3.M.var_ttw_tradefinder_ze_2_C.M, a3.M.M);
            od3.M.M.E(pf_0.r);
            od2.M.c.void_E();
        }
    }

    @Override
    public void focusGained(FocusEvent a2) {
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ od(sa_1 a2, JTextField a3, na_0 a4) {
        od a5;
        a5.M = a2;
        a5.b = a3;
        a5.c = a4;
    }
}

