/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ua;
import ttw.tradefinder.ze_2;

public class zF
implements ChangeListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ JSpinner b;
    public final /* synthetic */ lg c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ zF(lg a2, JSpinner a3, df_0 a4, ze_2 a5) {
        zF a6;
        zF zF2 = a6;
        zF2.c = a2;
        zF2.b = a3;
        a6.C = a4;
        a6.M = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        zF a3;
        a2 = a3.b.getModel();
        if (a2 instanceof SpinnerNumberModel && (Double)((SpinnerNumberModel)a2).getNumber() != ((ua)a3.C.M).a) {
            ((ua)a3.C.M).a = (Double)((SpinnerNumberModel)a2).getNumber();
            zF zF2 = a3;
            a3.c.E().E(ze_2.E((Object)"aab\u0018xTG^PApMEYZGPG"), zF2.M.M, a3.C);
            zF2.C.E(pf_0.U);
        }
    }
}

