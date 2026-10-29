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
import ttw.tradefinder.pa_0;
import ttw.tradefinder.xf_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.hF
 */
public class hf_0
implements ChangeListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ lg M;
    public final /* synthetic */ JSpinner b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        hf_0 a3;
        a2 = a3.b.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((pa_0)a3.C.M).H) {
            ((pa_0)a3.C.M).H = (Integer)((SpinnerNumberModel)a2).getNumber();
            a3.M.ttw_tradefinder_f_0_E().E(xf_0.E("qHr1h}Ww@h`dUpJn@n"), a3.c.M, a3.C);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ hf_0(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        hf_0 a6;
        hf_0 hf_02 = a6;
        hf_02.M = a2;
        hf_02.b = a3;
        a6.C = a4;
        a6.c = a5;
    }
}

