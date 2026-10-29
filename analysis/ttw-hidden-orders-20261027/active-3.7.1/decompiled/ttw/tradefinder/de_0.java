/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Zc;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ff_0;
import ttw.tradefinder.fg;
import ttw.tradefinder.pf_0;

/*
 * Renamed from ttw.tradefinder.DE
 */
public class de_0
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ String M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ fg c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        de_0 a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Zc)a3.b.M).E) {
            ((Zc)a3.b.M).E = (Integer)((SpinnerNumberModel)a2).getNumber();
            de_0 de_02 = a3;
            a3.c.E().E(ff_0.E("2\u00111h/(\u0004$\n$\b&\u0003\u0011\u0014$\u0005.\u00037"), de_02.M, a3.b);
            de_02.b.E(pf_0.s);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ de_0(fg a2, JSpinner a3, df_0 a4, String a5) {
        de_0 a6;
        de_0 de_02 = a6;
        de_02.c = a2;
        de_02.C = a3;
        a6.b = a4;
        a6.M = a5;
    }
}

