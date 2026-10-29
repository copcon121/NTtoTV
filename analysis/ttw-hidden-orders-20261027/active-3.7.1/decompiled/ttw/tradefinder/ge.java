/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.af_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sa_0;
import ttw.tradefinder.ze_2;

public class ge
implements ChangeListener {
    public final /* synthetic */ lg C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ JSpinner c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ge(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        ge a6;
        ge ge2 = a6;
        ge2.C = a2;
        ge2.c = a3;
        a6.M = a4;
        a6.b = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a22) {
        ge a3;
        a22 = a3.c.getModel();
        int a22 = ((SpinnerNumberModel)a22).getNumber().intValue();
        if (a22 != ((sa_0)a3.M.M).A) {
            ((sa_0)a3.M.M).A = a22;
            ge ge2 = a3;
            a3.C.E().E(af_2.E(":G9>#r\u001cx\u000bg+k\u001e\u007f\u0001a\u000ba"), ge2.b.M, a3.M);
            ge2.M.E(pf_0.x);
        }
    }
}

