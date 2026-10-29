/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.KB;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ua;
import ttw.tradefinder.ze_2;

public class rF
implements ChangeListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ JSpinner M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ lg c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ rF(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        rF a6;
        rF rF2 = a6;
        rF2.c = a2;
        rF2.M = a3;
        a6.C = a4;
        a6.b = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        rF a3;
        a2 = a3.M.getModel();
        if (a2 instanceof SpinnerNumberModel && (Double)((SpinnerNumberModel)a2).getNumber() != ((ua)a3.C.M).D) {
            ((ua)a3.C.M).D = (Double)((SpinnerNumberModel)a2).getNumber();
            rF rF2 = a3;
            a3.c.ttw_tradefinder_f_0_E().E(KB.E("\u0006\u0010\u0005i\u001f% /70\u0017<\"(=676"), rF2.b.M, a3.C);
            rF2.C.E(pf_0.U);
        }
    }
}

