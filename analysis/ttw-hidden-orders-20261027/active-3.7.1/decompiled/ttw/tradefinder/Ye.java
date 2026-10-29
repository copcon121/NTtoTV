/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Oa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.ie_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

public class Ye
implements ChangeListener {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ gd_0 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ JSpinner c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Ye(gd_0 a2, JSpinner a3, df_0 a4, ze_2 a5) {
        Ye a6;
        Ye ye = a6;
        ye.M = a2;
        ye.c = a3;
        a6.b = a4;
        a6.C = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        Ye a3;
        a2 = a3.c.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Oa)a3.b.M).e) {
            ((Oa)a3.b.M).e = (Integer)((SpinnerNumberModel)a2).getNumber();
            Ye ye = a3;
            a3.M.E().E(ie_0.E("\f5\u000fL\u0014\b)\u00141\u00051\u0015!5*\u0000;\n=\u0013"), ye.C.M, a3.b);
            ye.b.E(pf_0.w);
        }
    }
}

