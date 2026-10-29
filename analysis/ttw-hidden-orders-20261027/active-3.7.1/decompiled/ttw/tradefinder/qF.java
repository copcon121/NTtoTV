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
import ttw.tradefinder.gb_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;

public class qF
implements ChangeListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ dE b;
    public final /* synthetic */ JSpinner c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ qF(dE a2, JSpinner a3, df_0 a4, ze_2 a5) {
        qF a6;
        qF qF2 = a6;
        qF2.b = a2;
        qF2.c = a3;
        a6.C = a4;
        a6.M = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        double d2;
        qF a3;
        a2 = a3.c.getModel();
        if (a2 instanceof SpinnerNumberModel && (d2 = ((Double)((SpinnerNumberModel)a2).getNumber()).doubleValue()) != ((za_0)a3.C.M).a) {
            ((za_0)a3.C.M).a = d2;
            qF qF2 = a3;
            a3.b.E().E(gb_1.E("1\u00152l-(\u0001%\u0000/*3\u0001$\u00172"), qF2.M.M, a3.C);
            qF2.C.E(pf_0.P);
        }
    }
}

