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
import ttw.tradefinder.fg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.xf_0;

/*
 * Renamed from ttw.tradefinder.aD
 */
public class ad_1
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ String M;
    public final /* synthetic */ fg b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ad_1(fg a2, JSpinner a3, df_0 a4, String a5) {
        ad_1 a6;
        ad_1 ad_12 = a6;
        ad_12.b = a2;
        ad_12.C = a3;
        a6.c = a4;
        a6.M = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        ad_1 a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Zc)a3.c.M).a) {
            ((Zc)a3.c.M).a = (Integer)((SpinnerNumberModel)a2).getNumber();
            ad_1 ad_12 = a3;
            a3.b.E().E("TTW-ImbalanceTracker", ad_12.M, a3.c);
            ad_12.c.E(pf_0.J);
        }
    }
}

