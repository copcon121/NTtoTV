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
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ua;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.ze_2;

public class CF
implements ChangeListener {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ lg M;
    public final /* synthetic */ JSpinner b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ CF(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        CF a6;
        CF cF = a6;
        cF.M = a2;
        cF.b = a3;
        a6.c = a4;
        a6.C = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        CF a3;
        a2 = a3.b.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((ua)a3.c.M).j) {
            ((ua)a3.c.M).j = (Integer)((SpinnerNumberModel)a2).getNumber();
            CF cF = a3;
            a3.M.E().E("TTW-MarketExplorer", cF.C.M, a3.c);
            cF.c.E(pf_0.U);
        }
    }
}

