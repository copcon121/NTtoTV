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
import ttw.tradefinder.lg;
import ttw.tradefinder.nd_2;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.SD
 */
public class sd_0
implements ChangeListener {
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ lg b;
    public final /* synthetic */ String c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        double d2;
        sd_0 a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && (d2 = ((SpinnerNumberModel)a2).getNumber().doubleValue()) != ((Wa)a3.M.M).h) {
            ((Wa)a3.M.M).h = d2;
            sd_0 sd_02 = a3;
            sd_0 sd_03 = a3;
            a3.b.E().E("TTW-MarketExplorer", sd_02.A.M, sd_03.c, sd_03.M);
            sd_02.M.E(pf_0.Q);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ sd_0(lg a2, JSpinner a3, df_0 a4, ze_2 a5, String a6) {
        sd_0 a7;
        sd_0 sd_02 = a7;
        a7.b = a2;
        sd_02.C = a3;
        sd_02.M = a4;
        a7.A = a5;
        a7.c = a6;
    }
}

