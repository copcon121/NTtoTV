/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Wa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lD;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

public class lF
implements ChangeListener {
    public final /* synthetic */ df_0 A;
    public final /* synthetic */ lg C;
    public final /* synthetic */ String M;
    public final /* synthetic */ JSpinner b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        double d2;
        lF a3;
        a2 = a3.b.getModel();
        if (a2 instanceof SpinnerNumberModel && (d2 = ((SpinnerNumberModel)a2).getNumber().doubleValue()) != ((Wa)a3.A.M).C) {
            ((Wa)a3.A.M).C = d2;
            lF lF2 = a3;
            lF lF3 = a3;
            a3.C.E().E(lD.E("Z&Y_C\u0013|\u0019k\u0006K\n~\u001ea\u0000k\u0000"), lF2.c.M, lF3.M, lF3.A);
            lF2.A.E(pf_0.Q);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ lF(lg a2, JSpinner a3, df_0 a4, ze_2 a5, String a6) {
        lF a7;
        lF lF2 = a7;
        a7.C = a2;
        lF2.b = a3;
        lF2.A = a4;
        a7.c = a5;
        a7.M = a6;
    }
}

