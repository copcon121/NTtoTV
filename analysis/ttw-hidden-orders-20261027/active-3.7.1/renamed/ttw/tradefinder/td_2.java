/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Zc;
import ttw.tradefinder.ac_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.fg;
import ttw.tradefinder.pf_0;

/*
 * Renamed from ttw.tradefinder.tD
 */
public class td_2
implements ChangeListener {
    public final /* synthetic */ fg C;
    public final /* synthetic */ JSpinner M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ String c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        td_2 a3;
        a2 = a3.M.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Zc)a3.b.M).b) {
            ((Zc)a3.b.M).b = (Integer)((SpinnerNumberModel)a2).getNumber();
            td_2 td_22 = a3;
            a3.C.ttw_tradefinder_f_0_E().E(ac_2.E("@6CO]\u000fv\u0003x\u0003z\u0001q6f\u0003w\tq\u0010"), td_22.c, a3.b);
            td_22.b.E(pf_0.l);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ td_2(fg a2, JSpinner a3, df_0 a4, String a5) {
        td_2 a6;
        td_2 td_22 = a6;
        td_22.C = a2;
        td_22.M = a3;
        a6.b = a4;
        a6.c = a5;
    }
}

