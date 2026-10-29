/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Wa;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

public class cg
implements ChangeListener {
    public final /* synthetic */ df_0 A;
    public final /* synthetic */ lg C;
    public final /* synthetic */ String M;
    public final /* synthetic */ JSpinner b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void stateChanged(ChangeEvent a22) {
        cg a3;
        a22 = a3.b.getModel();
        int a22 = ((SpinnerNumberModel)a22).getNumber().intValue();
        if (a22 != ((Wa)a3.A.M).D) {
            ((Wa)a3.A.M).D = a22;
            cg cg2 = a3;
            cg cg3 = a3;
            a3.C.E().E("TTW-MarketExplorer", cg2.c.M, cg3.M, cg3.A);
            cg2.A.E(pf_0.Q);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ cg(lg a2, JSpinner a3, df_0 a4, ze_2 a5, String a6) {
        cg a7;
        cg cg2 = a7;
        a7.C = a2;
        cg2.b = a3;
        cg2.A = a4;
        a7.c = a5;
        a7.M = a6;
    }
}

