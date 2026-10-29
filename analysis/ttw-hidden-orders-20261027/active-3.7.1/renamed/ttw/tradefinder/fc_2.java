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
import ttw.tradefinder.lD;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.FC
 */
public class fc_2
implements ChangeListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ gd_0 b;
    public final /* synthetic */ JSpinner c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ fc_2(gd_0 a2, JSpinner a3, df_0 a4, ze_2 a5) {
        fc_2 a6;
        fc_2 fc_22 = a6;
        fc_22.b = a2;
        fc_22.c = a3;
        a6.C = a4;
        a6.M = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        fc_2 a3;
        a2 = a3.c.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Oa)a3.C.M).D) {
            ((Oa)a3.C.M).D = (Integer)((SpinnerNumberModel)a2).getNumber();
            fc_2 fc_22 = a3;
            a3.b.ttw_tradefinder_f_0_E().E(lD.E("Z&Y_B\u001b\u007f\u0007g\u0016g\u0006w&|\u0013m\u0019k\u0000"), fc_22.M.M, a3.C);
            fc_22.C.E(pf_0.y);
        }
    }
}

