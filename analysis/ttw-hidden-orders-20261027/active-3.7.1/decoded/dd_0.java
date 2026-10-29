/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Oa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.jc_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Dd
 */
public class dd_0
implements ChangeListener {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ gd_0 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ JSpinner c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        dd_0 a3;
        a2 = a3.c.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Oa)a3.b.M).G) {
            ((Oa)a3.b.M).G = (Integer)((SpinnerNumberModel)a2).getNumber();
            dd_0 dd_02 = a3;
            a3.M.E().E("TTW-LiquidityTracker", dd_02.C.M, a3.b);
            dd_02.b.E(pf_0.c);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ dd_0(gd_0 a2, JSpinner a3, df_0 a4, ze_2 a5) {
        dd_0 a6;
        dd_0 dd_02 = a6;
        dd_02.M = a2;
        dd_02.c = a3;
        a6.b = a4;
        a6.C = a5;
    }
}

