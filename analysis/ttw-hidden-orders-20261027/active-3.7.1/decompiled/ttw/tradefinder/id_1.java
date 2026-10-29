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
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.iD
 */
public class id_1
implements ChangeListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ fg M;
    public final /* synthetic */ JSpinner b;
    public final /* synthetic */ String c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        id_1 a3;
        a2 = a3.b.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Zc)a3.C.M).C) {
            ((Zc)a3.C.M).C = (Integer)((SpinnerNumberModel)a2).getNumber();
            id_1 id_12 = a3;
            a3.M.E().E(wa_2.E("lMo4qtZxTxVz]MJx[r]k"), id_12.c, a3.C);
            id_12.C.E(pf_0.J);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ id_1(fg a2, JSpinner a3, df_0 a4, String a5) {
        id_1 a6;
        id_1 id_12 = a6;
        id_12.M = a2;
        id_12.b = a3;
        a6.C = a4;
        a6.c = a5;
    }
}

