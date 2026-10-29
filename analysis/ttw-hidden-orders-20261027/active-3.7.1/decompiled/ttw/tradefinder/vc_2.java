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
import ttw.tradefinder.vE;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.VC
 */
public class vc_2
implements ChangeListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ gd_0 b;
    public final /* synthetic */ JSpinner c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ vc_2(gd_0 a2, JSpinner a3, df_0 a4, ze_2 a5) {
        vc_2 a6;
        vc_2 vc_22 = a6;
        vc_22.b = a2;
        vc_22.c = a3;
        a6.C = a4;
        a6.M = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        vc_2 a3;
        a2 = a3.c.getModel();
        if (a2 instanceof SpinnerNumberModel && (Double)((SpinnerNumberModel)a2).getNumber() != ((Oa)a3.C.M).K) {
            ((Oa)a3.C.M).K = (Double)((SpinnerNumberModel)a2).getNumber();
            vc_2 vc_22 = a3;
            a3.b.E().E(vE.E("\u0003/\u0000V\u001b\u0012&\u000e>\u001f>\u000f./%\u001a4\u00102\t"), vc_22.M.M, a3.C);
            vc_22.C.E(pf_0.F);
        }
    }
}

