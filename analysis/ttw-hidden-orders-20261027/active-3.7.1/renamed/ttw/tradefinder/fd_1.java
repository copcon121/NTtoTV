/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sa_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.wd_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.FD
 */
public class fd_1
implements ItemListener {
    public final /* synthetic */ df_0 A;
    public final /* synthetic */ JCheckBox C;
    public final /* synthetic */ lg M;
    public final /* synthetic */ sc_1 b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        fd_1 a3;
        if (a3.C.isSelected() != ((sa_0)a3.A.M).M) {
            ((sa_0)a3.A.M).M = a3.C.isSelected();
            fd_1 fd_12 = a3;
            fd_12.b.E(((sa_0)fd_12.A.M).M);
            fd_1 fd_13 = a3;
            a3.M.ttw_tradefinder_f_0_E().E(wd_2.E("%`&\u0019<U\u0003_\u0014@4L\u0001X\u001eF\u0014F"), fd_13.c.M, a3.A);
            fd_13.A.E(pf_0.f);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ fd_1(lg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        fd_1 a7;
        fd_1 fd_12 = a7;
        a7.M = a2;
        fd_12.C = a3;
        fd_12.A = a4;
        a7.b = a5;
        a7.c = a6;
    }
}

