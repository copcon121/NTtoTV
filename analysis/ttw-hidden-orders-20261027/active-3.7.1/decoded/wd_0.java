/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ed_2;
import ttw.tradefinder.lg;
import ttw.tradefinder.pa_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.WD
 */
public class wd_0
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ lg M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ wd_0(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        wd_0 a6;
        wd_0 wd_02 = a6;
        wd_02.M = a2;
        wd_02.C = a3;
        a6.c = a4;
        a6.b = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        wd_0 a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && ((SpinnerNumberModel)a2).getNumber().doubleValue() != ((pa_0)a3.c.M).c) {
            ((pa_0)a3.c.M).c = ((SpinnerNumberModel)a2).getNumber().doubleValue();
            a3.M.E().E("TTW-MarketExplorer", a3.b.M, a3.c);
        }
    }
}

