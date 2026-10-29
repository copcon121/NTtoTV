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
import ttw.tradefinder.sd_1;
import ttw.tradefinder.xa_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.TD
 */
public class td_1
implements ChangeListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ JSpinner b;
    public final /* synthetic */ lg c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ td_1(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        td_1 a6;
        td_1 td_12 = a6;
        td_12.c = a2;
        td_12.b = a3;
        a6.C = a4;
        a6.M = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        double d2;
        td_1 a3;
        a2 = a3.b.getModel();
        if (a2 instanceof SpinnerNumberModel && (d2 = ((SpinnerNumberModel)a2).getNumber().doubleValue()) != ((xa_0)a3.C.M).M) {
            ((xa_0)a3.C.M).M = d2;
            td_1 td_12 = a3;
            a3.c.E().E(sd_1.E("ukv\u0012l^STDKdGQSNMDM"), td_12.M.M, a3.C);
            td_12.C.E(pf_0.Ca);
        }
    }
}

