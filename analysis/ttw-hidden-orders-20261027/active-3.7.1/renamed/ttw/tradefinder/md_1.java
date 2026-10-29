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
import ttw.tradefinder.nd_2;
import ttw.tradefinder.ra;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.MD
 */
public class md_1
implements ChangeListener {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ JSpinner M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ lg c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        md_1 a3;
        a2 = a3.M.getModel();
        if (a2 instanceof SpinnerNumberModel && (Double)((SpinnerNumberModel)a2).getNumber() != ((ra)a3.b.M).c) {
            ((ra)a3.b.M).c = (Double)((SpinnerNumberModel)a2).getNumber();
            a3.c.ttw_tradefinder_f_0_E().E(nd_2.E("~m}\u0014gXXROMoAZUEKOK"), a3.C.M, a3.b);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ md_1(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        md_1 a6;
        md_1 md_12 = a6;
        md_12.c = a2;
        md_12.M = a3;
        a6.b = a4;
        a6.C = a5;
    }
}

