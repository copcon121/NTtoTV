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
 * Renamed from ttw.tradefinder.RA
 */
public class ra_2
implements ActionListener {
    public final /* synthetic */ zf_1 A;
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ DecimalFormat M;
    public final /* synthetic */ zf_1 b;
    public final /* synthetic */ gd_0 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        ra_2 a3;
        a2 = a3.c.A.E(a3.C.M);
        if (!(a2 instanceof oc_2)) {
            return;
        }
        a2 = (oc_2)a2;
        a2 = ((oc_2)a2).E();
        a3.c.b.put(a3.C.M, (pb_2)a2);
        ra_2 ra_22 = a3;
        a3.c.E(ra_22.b, ((pb_2)a2).A, a3.M);
        ra_22.c.E(a3.A, ((pb_2)a2).C, a3.M);
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ra_2(gd_0 a2, ze_2 a3, zf_1 a4, DecimalFormat a5, zf_1 a6) {
        ra_2 a7;
        ra_2 ra_22 = a7;
        a7.c = a2;
        ra_22.C = a3;
        ra_22.b = a4;
        a7.M = a5;
        a7.A = a6;
    }
}

