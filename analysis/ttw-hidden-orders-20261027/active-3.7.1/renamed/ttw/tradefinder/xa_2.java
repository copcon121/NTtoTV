/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.na_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.xA
 */
public class xa_2
implements ChangeListener {
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ na_0 C;
    public final /* synthetic */ bb_1 M;
    public final /* synthetic */ JSpinner b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ xa_2(bb_1 a2, JSpinner a3, ze_2 a4, na_0 a5, df_0 a6) {
        xa_2 a7;
        xa_2 xa_22 = a7;
        a7.M = a2;
        xa_22.b = a3;
        xa_22.A = a4;
        a7.C = a5;
        a7.c = a6;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        xa_2 a3;
        a2 = a3.b.getModel();
        if (a2 instanceof SpinnerNumberModel && (a2 = (int)((Double)((SpinnerNumberModel)a2).getNumber() / a3.A.c)) != a3.C.H) {
            xa_2 xa_22 = a3;
            xa_22.C.H = a2;
            xa_2 xa_23 = a3;
            xa_22.M.ttw_tradefinder_f_0_E().E(a3.M.ttw_tradefinder_r_0_E().f(), xa_23.A.M, a3.c);
            xa_23.c.E(pf_0.r);
            xa_22.M.l(a3.A.M);
        }
    }
}

