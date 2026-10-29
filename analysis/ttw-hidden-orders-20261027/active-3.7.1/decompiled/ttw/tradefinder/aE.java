/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.ra;
import ttw.tradefinder.xf_0;
import ttw.tradefinder.ze_2;

public class aE
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ lg M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        aE a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((ra)a3.b.M).M) {
            ((ra)a3.b.M).M = (Integer)((SpinnerNumberModel)a2).getNumber();
            a3.M.E().E(xf_0.E("qHr1h}Ww@h`dUpJn@n"), a3.c.M, a3.b);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ aE(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        aE a6;
        aE aE2 = a6;
        aE2.M = a2;
        aE2.C = a3;
        a6.b = a4;
        a6.c = a5;
    }
}

