/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.b;
import ttw.tradefinder.df_1;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

public class ra
extends wa_2<b> {
    public df_1 D;
    public boolean A;
    public df_1 C;
    public int M;
    public gf_2 b;
    public double c;

    public ra(double a2) {
        ra a3;
        ra ra2 = a3;
        super(b.class);
        a3.A = true;
        a3.b = new gf_2(te_1.A, rd_2.C, false);
        ra2.c = 200.0;
        a3.M = 4;
        ra2.D = df_1.b;
        a3.C = df_1.b;
        a3.c /= a2;
    }

    @Override
    public void E(b a2) {
        ra a3;
        b b2 = a2;
        ra ra2 = a3;
        b b3 = a2;
        a3.b = (gf_2)b3.IsDefault;
        ra2.A = b3.a;
        ra2.c = a2.b;
        a3.M = b2.c;
        if (b2.d != null) {
            a3.b.E(a2.d);
        }
        if (a2.e != null) {
            a3.D = va.E(a2.e);
        }
        if (a2.f != null) {
            a3.C = va.E(a2.f);
        }
    }

    @Override
    public b E() {
        ra a2;
        b b2 = new b();
        new b().IsDefault = a2.b;
        ra ra2 = a2;
        b b3 = b2;
        ra ra3 = a2;
        b2.a = ra3.A;
        b3.b = ra3.c;
        b3.c = a2.M;
        b2.d = ra2.b.ttw_tradefinder_go_E();
        b2.e = va.E(ra2.D);
        b2.f = va.E(a2.C);
        return b2;
    }
}

