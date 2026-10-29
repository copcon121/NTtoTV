/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Collection;
import java.util.Collections;
import ttw.tradefinder.c_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ib_2;
import ttw.tradefinder.j_0;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.za_2;
import ttw.tradefinder.ze_2;

public class sd
extends ib_2 {
    @Override
    public c_0 E(f_0 a2, ze_2 a3, xf_2 a4) {
        sd a5;
        a2 = new za_2(a5.E().f(), (f_0)a2, a3, a5);
        sd sd2 = a5;
        sd2.a(a3.M, sd2.E().E(), (j_0)a2);
        return a2;
    }

    public sd(f_0 a2, r_0 a3) {
        super(a2, a3);
        sd a4;
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        return Collections.emptyList();
    }
}

