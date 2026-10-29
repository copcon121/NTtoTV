/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.na_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sa_1;

/*
 * Renamed from ttw.tradefinder.pc
 */
public class pc_0
implements ChangeListener {
    public final /* synthetic */ JSpinner M;
    public final /* synthetic */ na_0 b;
    public final /* synthetic */ sa_1 c;

    @Override
    public void stateChanged(ChangeEvent a2) {
        pc_0 a3;
        a2 = a3.M.getModel();
        if (a2 instanceof SpinnerNumberModel && (a2 = (int)((Double)((SpinnerNumberModel)a2).getNumber() / a3.c.C.c)) != a3.b.H) {
            pc_0 pc_02 = a3;
            pc_02.b.H = a2;
            pc_0 pc_03 = a3;
            pc_02.c.c.E(a3.c.b, pc_03.c.C.M, a3.c.M);
            pc_03.c.M.E(pf_0.r);
            pc_02.c.c.E();
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ pc_0(sa_1 a2, JSpinner a3, na_0 a4) {
        pc_0 a5;
        a5.c = a2;
        a5.M = a3;
        a5.b = a4;
    }
}

