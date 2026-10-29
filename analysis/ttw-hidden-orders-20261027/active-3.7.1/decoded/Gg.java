/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ff_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.xa_0;
import ttw.tradefinder.ze_2;

public class Gg
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ lg b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void stateChanged(ChangeEvent a22) {
        Gg a3;
        a22 = a3.C.getModel();
        int a22 = ((SpinnerNumberModel)a22).getNumber().intValue();
        if (a22 != ((xa_0)a3.M.M).c) {
            ((xa_0)a3.M.M).c = a22;
            Gg gg = a3;
            a3.b.E().E("TTW-MarketExplorer", gg.c.M, a3.M);
            gg.M.E(pf_0.b);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Gg(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        Gg a6;
        Gg gg = a6;
        gg.b = a2;
        gg.C = a3;
        a6.M = a4;
        a6.c = a5;
    }
}

