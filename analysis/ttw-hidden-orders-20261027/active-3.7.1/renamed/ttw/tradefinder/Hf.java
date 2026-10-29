/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Wa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

public class Hf
implements ChangeListener {
    public final /* synthetic */ JSpinner A;
    public final /* synthetic */ String C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ lg c;

    @Override
    public void stateChanged(ChangeEvent a22) {
        Hf a3;
        a22 = a3.A.getModel();
        int a22 = ((SpinnerNumberModel)a22).getNumber().intValue();
        if (a22 != ((Wa)a3.b.M).A) {
            ((Wa)a3.b.M).A = a22;
            Hf hf = a3;
            Hf hf2 = a3;
            a3.c.ttw_tradefinder_f_0_E().E(ze_2.E((Object)"aab\u0018xTG^PApMEYZGPG"), hf.M.M, hf2.C, hf2.b);
            hf.b.E(pf_0.Q);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Hf(lg a2, JSpinner a3, df_0 a4, ze_2 a5, String a6) {
        Hf a7;
        Hf hf = a7;
        a7.c = a2;
        hf.A = a3;
        hf.b = a4;
        a7.M = a5;
        a7.C = a6;
    }
}

