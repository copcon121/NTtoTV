/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ob_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Xc
 */
public class xc_2
implements ChangeListener {
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ ob_1 b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ xc_2(ob_1 a2, df_0 a3, ze_2 a4) {
        xc_2 a5;
        a5.b = a2;
        a5.c = a3;
        a5.M = a4;
    }

    @Override
    public void stateChanged(ChangeEvent a22) {
        xc_2 a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        if (a22 != ((ua_0)a3.c.M).M) {
            ((ua_0)a3.c.M).M = a22;
            xc_2 xc_22 = a3;
            a3.b.E().E(a3.b.E().f(), xc_22.M.M, a3.c);
            xc_22.c.E(pf_0.B);
        }
    }
}

