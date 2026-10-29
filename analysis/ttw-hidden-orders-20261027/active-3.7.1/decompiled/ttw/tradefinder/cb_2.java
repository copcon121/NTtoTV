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
 * Renamed from ttw.tradefinder.cb
 */
public class cb_2
implements ChangeListener {
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ oc_1 b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ cb_2(oc_1 a2, df_0 a3, ze_2 a4) {
        cb_2 a5;
        a5.b = a2;
        a5.c = a3;
        a5.M = a4;
    }

    @Override
    public void stateChanged(ChangeEvent a22) {
        cb_2 a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        if (a22 != ((LC)a3.c.M).C) {
            ((LC)a3.c.M).C = a22;
            cb_2 cb_22 = a3;
            a3.b.E().E(a3.b.E().f(), cb_22.M.M, a3.c);
            cb_22.c.E(pf_0.q);
        }
    }
}

