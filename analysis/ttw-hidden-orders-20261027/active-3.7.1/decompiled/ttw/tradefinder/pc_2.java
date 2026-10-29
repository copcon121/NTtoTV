/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.Oa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.fg_0;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.pC
 */
public class pc_2
implements ChangeListener {
    public final /* synthetic */ JSpinner C;
    public final /* synthetic */ gd_0 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ze_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ pc_2(gd_0 a2, JSpinner a3, df_0 a4, ze_2 a5) {
        pc_2 a6;
        pc_2 pc_22 = a6;
        pc_22.M = a2;
        pc_22.C = a3;
        a6.b = a4;
        a6.c = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        pc_2 a3;
        a2 = a3.C.getModel();
        if (a2 instanceof SpinnerNumberModel && (Double)((SpinnerNumberModel)a2).getNumber() != ((Oa)a3.b.M).J) {
            ((Oa)a3.b.M).J = (Double)((SpinnerNumberModel)a2).getNumber();
            pc_2 pc_22 = a3;
            a3.M.E().E(fg_0.E("$B';<\u007f\u0001c\u0019r\u0019b\tB\u0002w\u0013}\u0015d"), pc_22.c.M, a3.b);
            pc_22.b.E(pf_0.X);
        }
    }
}

