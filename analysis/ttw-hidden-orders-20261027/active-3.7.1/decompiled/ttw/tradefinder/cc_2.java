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
import ttw.tradefinder.wd_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.CC
 */
public class cc_2
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ gd_0 c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        cc_2 a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Oa)a3.M.M).i) {
            ((Oa)a3.M.M).i = (Integer)((SpinnerNumberModel)a2).getNumber();
            cc_2 cc_22 = a3;
            a3.c.E().E(wd_1.E("`\u001dcdx E<]-]=M\u001dF(W\"Q;"), cc_22.b.M, a3.M);
            cc_22.M.E(pf_0.e);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ cc_2(gd_0 a2, JSpinner a3, df_0 a4, ze_2 a5) {
        cc_2 a6;
        cc_2 cc_22 = a6;
        cc_22.c = a2;
        cc_22.C = a3;
        a6.M = a4;
        a6.b = a5;
    }
}

