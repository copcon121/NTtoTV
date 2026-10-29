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
import ttw.tradefinder.sf_0;
import ttw.tradefinder.ze_2;

public class KF
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ gd_0 b;
    public final /* synthetic */ ze_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ KF(gd_0 a2, JSpinner a3, df_0 a4, ze_2 a5) {
        KF a6;
        KF kF = a6;
        kF.b = a2;
        kF.C = a3;
        a6.M = a4;
        a6.c = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        KF a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Oa)a3.M.M).C) {
            ((Oa)a3.M.M).C = (Integer)((SpinnerNumberModel)a2).getNumber();
            KF kF = a3;
            a3.b.E().E(sf_0.E("\"0!I:\r\u0007\u0011\u001f\u0000\u001f\u0010\u000f0\u0004\u0005\u0015\u000f\u0013\u0016"), kF.c.M, a3.M);
            kF.M.E(pf_0.z);
        }
    }
}

