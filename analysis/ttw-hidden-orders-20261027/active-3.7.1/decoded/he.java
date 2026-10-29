/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Oc;
import ttw.tradefinder.Zc;
import ttw.tradefinder.df_0;
import ttw.tradefinder.fg;
import ttw.tradefinder.pf_0;

public class he
implements ChangeListener {
    public final /* synthetic */ fg C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ String b;
    public final /* synthetic */ JSpinner c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        he a3;
        a2 = a3.c.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Zc)a3.M.M).c) {
            ((Zc)a3.M.M).c = (Integer)((SpinnerNumberModel)a2).getNumber();
            he he2 = a3;
            a3.C.E().E("TTW-ImbalanceTracker", he2.b, a3.M);
            he2.M.E(pf_0.s);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ he(fg a2, JSpinner a3, df_0 a4, String a5) {
        he a6;
        he he2 = a6;
        he2.C = a2;
        he2.c = a3;
        a6.M = a4;
        a6.b = a5;
    }
}

