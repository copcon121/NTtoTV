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
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.oB
 */
public class ob_2
extends xb_2
implements c_0,
o_0 {
    private final vc_1 c;

    @Override
    public l_0 E() {
        ob_2 a2;
        return a2.c;
    }

    @Override
    public void j() {
        ob_2 a2;
        ob_2 ob_22 = a2;
        super.j();
        ob_22.c.E();
    }

    public ob_2(f_0 a2, ze_2 a3, s_0 a4) {
        super(a2, a3, a4);
        ob_2 a5;
        a5.c = new vc_1(a2, a3);
    }

    @Override
    public boolean E() {
        ob_2 a2;
        return a2.c.E();
    }

    @Override
    public void E(boolean a2) {
    }

    @Override
    public void E() {
        ob_2 a2;
        super.E();
    }

    public boolean E(boolean a2) {
        ob_2 a3;
        if (a3.c.E() == a2) {
            return false;
        }
        ob_2 ob_22 = a3;
        boolean bl = a2;
        ob_22.c.E(bl);
        ob_22.j(bl);
        return true;
    }
}

