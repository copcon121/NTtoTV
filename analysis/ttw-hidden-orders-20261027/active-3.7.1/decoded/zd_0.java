/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Ff;
import ttw.tradefinder.Ob;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.zd
 */
public class zd_0
implements ChangeListener {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ lg b;
    public final /* synthetic */ JSpinner c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ zd_0(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        zd_0 a6;
        zd_0 zd_02 = a6;
        zd_02.b = a2;
        zd_02.c = a3;
        a6.M = a4;
        a6.C = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        zd_0 a3;
        a2 = a3.c.getModel();
        if (a2 instanceof SpinnerNumberModel && (Double)((SpinnerNumberModel)a2).getNumber() != ((Ob)a3.M.M).D) {
            ((Ob)a3.M.M).D = (Double)((SpinnerNumberModel)a2).getNumber();
            a3.b.E().E("TTW-MarketExplorer", a3.C.M, a3.M);
        }
    }
}

