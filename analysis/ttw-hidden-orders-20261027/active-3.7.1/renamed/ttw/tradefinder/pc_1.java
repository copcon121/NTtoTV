/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.text.DecimalFormat;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.oc_2;
import ttw.tradefinder.pb_2;
import ttw.tradefinder.ze_2;
import ttw.tradefinder.zf_1;

/*
 * Renamed from ttw.tradefinder.PC
 */
public class pc_1
implements ActionListener {
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ DecimalFormat C;
    public final /* synthetic */ gd_0 M;
    public final /* synthetic */ zf_1 b;
    public final /* synthetic */ zf_1 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ pc_1(gd_0 a2, ze_2 a3, zf_1 a4, DecimalFormat a5, zf_1 a6) {
        pc_1 a7;
        pc_1 pc_12 = a7;
        a7.M = a2;
        pc_12.A = a3;
        pc_12.b = a4;
        a7.C = a5;
        a7.c = a6;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        pc_1 a3;
        a2 = a3.M.A.ttw_tradefinder_c_0_E(a3.A.M);
        if (!(a2 instanceof oc_2)) {
            return;
        }
        a2 = (oc_2)a2;
        a2 = ((oc_2)a2).ttw_tradefinder_pb_2_E();
        a3.M.c.put(a3.A.M, (pb_2)a2);
        pc_1 pc_12 = a3;
        a3.M.E(pc_12.b, ((pb_2)a2).M, a3.C);
        pc_12.M.E(a3.c, ((pb_2)a2).b, a3.C);
    }
}

