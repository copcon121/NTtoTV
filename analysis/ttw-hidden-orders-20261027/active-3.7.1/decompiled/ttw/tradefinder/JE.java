/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Oc;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ua;
import ttw.tradefinder.ze_2;

public class JE
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ lg c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        JE a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && (Double)((SpinnerNumberModel)a2).getNumber() != ((ua)a3.b.M).c) {
            ((ua)a3.b.M).c = (Double)((SpinnerNumberModel)a2).getNumber();
            JE jE = a3;
            a3.c.E().E(Oc.E("0a3\u0018)T\u0016^\u0001A!M\u0014Y\u000bG\u0001G"), jE.M.M, a3.b);
            jE.b.E(pf_0.U);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ JE(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        JE a6;
        JE jE = a6;
        jE.c = a2;
        jE.C = a3;
        a6.b = a4;
        a6.M = a5;
    }
}

