/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Ob;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.ze_2;

public class VF
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ lg b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        VF a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && (Double)((SpinnerNumberModel)a2).getNumber() != ((Ob)a3.M.M).H) {
            ((Ob)a3.M.M).H = (Double)((SpinnerNumberModel)a2).getNumber();
            a3.b.E().E(wa_2.E("lMo4uxJr]m}aHuWk]k"), a3.c.M, a3.M);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ VF(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        VF a6;
        VF vF = a6;
        vF.b = a2;
        vF.C = a3;
        a6.M = a4;
        a6.c = a5;
    }
}

