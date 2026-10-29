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
import ttw.tradefinder.gc_1;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

public class MF
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ gd_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ MF(gd_0 a2, JSpinner a3, df_0 a4, ze_2 a5) {
        MF a6;
        MF mF = a6;
        mF.c = a2;
        mF.C = a3;
        a6.b = a4;
        a6.M = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        MF a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Oa)a3.b.M).H) {
            ((Oa)a3.b.M).H = (Integer)((SpinnerNumberModel)a2).getNumber();
            MF mF = a3;
            a3.c.ttw_tradefinder_f_0_E().E(gc_1.E("f6eO~\u000bC\u0017[\u0006[\u0016K6@\u0003Q\tW\u0010"), mF.M.M, a3.b);
            mF.b.E(pf_0.y);
        }
    }
}

