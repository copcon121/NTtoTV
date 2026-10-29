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
import ttw.tradefinder.gb_1;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

public class Mg
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ gd_0 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        Mg a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Oa)a3.b.M).M) {
            ((Oa)a3.b.M).M = (Integer)((SpinnerNumberModel)a2).getNumber();
            Mg mg = a3;
            a3.M.E().E(gb_1.E("1\u00152l)(\u00144\f%\f5\u001c\u0015\u0017 \u0006*\u00003"), mg.c.M, a3.b);
            mg.b.E(pf_0.z);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Mg(gd_0 a2, JSpinner a3, df_0 a4, ze_2 a5) {
        Mg a6;
        Mg mg = a6;
        mg.M = a2;
        mg.C = a3;
        a6.b = a4;
        a6.c = a5;
    }
}

