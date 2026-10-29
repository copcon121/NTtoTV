/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Oa;
import ttw.tradefinder.ae_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.kA
 */
public class ka_0
implements ChangeListener {
    public final /* synthetic */ gd_0 C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ JSpinner c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ka_0(gd_0 a2, JSpinner a3, df_0 a4, ze_2 a5) {
        ka_0 a6;
        ka_0 ka_02 = a6;
        ka_02.C = a2;
        ka_02.c = a3;
        a6.M = a4;
        a6.b = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        ka_0 a3;
        a2 = a3.c.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Oa)a3.M.M).b) {
            ((Oa)a3.M.M).b = (Integer)((SpinnerNumberModel)a2).getNumber();
            ka_0 ka_02 = a3;
            a3.C.E().E(ae_1.E("PuS\fHHuTmEmU}uv@gJaS"), ka_02.b.M, a3.M);
            ka_02.M.E(pf_0.e);
        }
    }
}

