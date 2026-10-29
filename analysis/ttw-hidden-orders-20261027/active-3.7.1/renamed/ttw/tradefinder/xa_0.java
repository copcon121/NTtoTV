/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.df_1;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.i;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.Xa
 */
public class xa_0
extends wa_2<i> {
    public boolean D;
    public gf_2 A;
    public df_1 C;
    public double M;
    public df_1 b;
    public int c;

    @Override
    public void E(i a2) {
        xa_0 a3;
        i i2 = a2;
        xa_0 xa_02 = a3;
        i i3 = a2;
        a3.b = (df_1)i3.IsDefault;
        xa_02.D = i3.a;
        xa_02.M = a2.b;
        a3.c = i2.c;
        if (i2.e != null) {
            a3.C = va.E(a2.e);
        }
        if (a2.f != null) {
            a3.b = va.E(a2.f);
        }
        if (a2.d != null) {
            a3.A.E(a2.d);
        }
    }

    @Override
    public i E() {
        xa_0 a2;
        i i2 = new i();
        new i().IsDefault = a2.b;
        xa_0 xa_02 = a2;
        i i3 = i2;
        xa_0 xa_03 = a2;
        i2.a = xa_03.D;
        i3.b = xa_03.M;
        i3.c = a2.c;
        i2.d = xa_02.A.ttw_tradefinder_go_E();
        i2.e = va.E(xa_02.C);
        i2.f = va.E(a2.b);
        return i2;
    }

    public xa_0(double a2) {
        xa_0 a3;
        xa_0 xa_02 = a3;
        super(i.class);
        a3.D = true;
        xa_02.M = 150.0;
        a3.c = 10;
        xa_02.A = new gf_2(te_1.A, rd_2.M, false);
        a3.C = df_1.b;
        a3.b = df_1.b;
        a3.M /= a2;
    }
}

