/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.dE;
import ttw.tradefinder.df_0;
import ttw.tradefinder.nd_2;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;

public class yF
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ dE b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        double d2;
        yF a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && (d2 = ((Double)((SpinnerNumberModel)a2).getNumber()).doubleValue()) != ((za_0)a3.M.M).h) {
            ((za_0)a3.M.M).h = d2;
            yF yF2 = a3;
            a3.b.ttw_tradefinder_f_0_E().E(nd_2.E("~m}\u0014bPN]OWeKN\\XJ"), yF2.c.M, a3.M);
            yF2.M.E(pf_0.A);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ yF(dE a2, JSpinner a3, df_0 a4, ze_2 a5) {
        yF a6;
        yF yF2 = a6;
        yF2.b = a2;
        yF2.C = a3;
        a6.M = a4;
        a6.c = a5;
    }
}

