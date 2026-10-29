/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.bf_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sa_0;
import ttw.tradefinder.ze_2;

public class uf
implements ChangeListener {
    public final /* synthetic */ lg C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ JSpinner b;
    public final /* synthetic */ df_0 c;

    @Override
    public void stateChanged(ChangeEvent a22) {
        uf a3;
        a22 = a3.b.getModel();
        int a22 = ((SpinnerNumberModel)a22).getNumber().intValue();
        if (a22 != ((sa_0)a3.c.M).C) {
            ((sa_0)a3.c.M).C = a22;
            uf uf2 = a3;
            a3.C.E().E(bf_0.E("1h2\u0011(]\u0017W\u0000H D\u0015P\nN\u0000N"), uf2.M.M, a3.c);
            uf2.c.E(pf_0.x);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ uf(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        uf a6;
        uf uf2 = a6;
        uf2.C = a2;
        uf2.b = a3;
        a6.c = a4;
        a6.M = a5;
    }
}

