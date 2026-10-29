/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.c_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.l_0;
import ttw.tradefinder.o_0;
import ttw.tradefinder.s_0;
import ttw.tradefinder.vc_1;
import ttw.tradefinder.xb_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.oB
 */
public class ob_2
extends xb_2
implements c_0,
o_0 {
    private final vc_1 c;

    @Override
    public l_0 ttw_tradefinder_l_0_E() {
        ob_2 a2;
        return a2.c;
    }

    @Override
    public void void_j() {
        ob_2 a2;
        ob_2 ob_22 = a2;
        super.void_j();
        ob_22.c.void_E();
    }

    public ob_2(f_0 a2, ze_2 a3, s_0 a4) {
        super(a2, a3, a4);
        ob_2 a5;
        a5.c = new vc_1(a2, a3);
    }

    @Override
    public boolean boolean_E() {
        ob_2 a2;
        return a2.c.boolean_E();
    }

    @Override
    public void void_E(boolean a2) {
    }

    @Override
    public void void_E() {
        ob_2 a2;
        super.void_E();
    }

    public boolean boolean_E(boolean a2) {
        ob_2 a3;
        if (a3.c.boolean_E() == a2) {
            return false;
        }
        ob_2 ob_22 = a3;
        boolean bl = a2;
        ob_22.c.E(bl);
        ob_22.j(bl);
        return true;
    }
}

