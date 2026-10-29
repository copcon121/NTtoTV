/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.LC;
import ttw.tradefinder.df_0;
import ttw.tradefinder.oc_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.nB
 */
public class nb_1
implements ChangeListener {
    public final /* synthetic */ oc_1 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ df_0 c;

    @Override
    public void stateChanged(ChangeEvent a22) {
        nb_1 a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        if (a22 != ((LC)a3.c.M).c) {
            ((LC)a3.c.M).c = a22;
            nb_1 nb_12 = a3;
            a3.M.ttw_tradefinder_f_0_E().E(a3.M.ttw_tradefinder_r_0_E().f(), nb_12.b.M, a3.c);
            nb_12.c.E(pf_0.q);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ nb_1(oc_1 a2, df_0 a3, ze_2 a4) {
        nb_1 a5;
        a5.M = a2;
        a5.c = a3;
        a5.b = a4;
    }
}

