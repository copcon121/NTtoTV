/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.dc_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.la_2;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.jb
 */
public class jb_1
implements ChangeListener {
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ la_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ jb_1(la_2 a2, df_0 a3, ze_2 a4) {
        jb_1 a5;
        a5.c = a2;
        a5.b = a3;
        a5.M = a4;
    }

    @Override
    public void stateChanged(ChangeEvent a222) {
        jb_1 a3;
        int a222 = ((JSlider)(a222 = (JSlider)a222.getSource())).getValue();
        if (a222 != ((dc_2)a3.b.M).c) {
            ((dc_2)a3.b.M).c = a222;
            jb_1 jb_12 = a3;
            jb_1 jb_13 = a3;
            jb_12.c.E().E(jb_13.c.E().f(), a3.M.M, a3.b);
            jb_12.b.E(pf_0.v);
            Object a222 = jb_13.c.b;
            synchronized (a222) {
                if (a3.c.M.containsKey(a3.M.M)) {
                    a3.c.M.get(a3.M.M).pack();
                }
                return;
            }
        }
    }
}

