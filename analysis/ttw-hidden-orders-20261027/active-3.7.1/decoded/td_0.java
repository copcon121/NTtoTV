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
import ttw.tradefinder.pf_0;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Td
 */
public class td_0
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ gd_0 c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        td_0 a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Oa)a3.M.M).c) {
            ((Oa)a3.M.M).c = (Integer)((SpinnerNumberModel)a2).getNumber();
            td_0 td_02 = a3;
            a3.c.E().E("TTW-LiquidityTracker", td_02.b.M, a3.M);
            td_02.M.E(pf_0.c);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ td_0(gd_0 a2, JSpinner a3, df_0 a4, ze_2 a5) {
        td_0 a6;
        td_0 td_02 = a6;
        td_02.c = a2;
        td_02.C = a3;
        a6.M = a4;
        a6.b = a5;
    }
}

