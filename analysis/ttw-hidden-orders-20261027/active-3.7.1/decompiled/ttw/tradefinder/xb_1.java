/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import ttw.tradefinder.K;
import ttw.tradefinder.Pc;
import ttw.tradefinder.c_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.cd_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ib_2;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.ob_2;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.wd_1;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Xb
 */
public class xb_1
extends ib_2 {
    private final K c;

    public xb_1(f_0 a2, r_0 a3) {
        super((f_0)a2, a3);
        xb_1 a4;
        a2 = new Pc(wd_1.E("\nX&A-z&@,G\rQ?g,@=]'S:"), Arrays.asList(cd.C, cd.c, cd.D), a2.E());
        a4.c = a2.E(new cd_0(a4));
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        a2 = new ArrayList();
        return a2;
    }

    @Override
    public void a() {
        xb_1 a2;
        xb_1 xb_12 = a2;
        super.a();
        xb_12.c.E();
    }

    @Override
    public c_0 E(f_0 a2, ze_2 a3, xf_2 a4) {
        xb_1 a5;
        a2 = new ob_2((f_0)a2, a3, a5);
        return a2;
    }
}

