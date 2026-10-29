/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.df_1;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.iy;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

public class Wa
extends wa_2<iy> {
    public double h;
    public boolean H;
    public int D;
    public int A;
    public double C;
    public gf_2 M;
    public df_1 b;
    public df_1 c;

    @Override
    public iy E() {
        Wa a2;
        iy iy2 = new iy();
        new iy().IsDefault = a2.b;
        Wa wa = a2;
        iy iy3 = iy2;
        Wa wa2 = a2;
        iy iy4 = iy2;
        iy4.b = a2.H;
        iy4.a = a2.h;
        iy2.c = wa2.C;
        iy3.d = wa2.M.ttw_tradefinder_go_E();
        iy3.e = va.E(a2.b);
        iy2.f = va.E(wa.c);
        iy2.g = wa.A;
        iy2.h = a2.D;
        return iy2;
    }

    @Override
    public void E(iy a2) {
        Wa a3;
        iy iy2 = a2;
        Wa wa = a3;
        iy iy3 = a2;
        Wa wa2 = a3;
        wa2.b = (df_1)a2.IsDefault;
        wa2.H = a2.b;
        a3.h = iy3.a;
        wa.C = iy3.c;
        wa.A = a2.g;
        a3.D = iy2.h;
        if (iy2.e != null) {
            a3.b = va.E(a2.e);
        }
        if (a2.f != null) {
            a3.c = va.E(a2.f);
        }
        if (a2.d != null) {
            a3.M.E(a2.d);
        }
    }

    public Wa(double a2) {
        Wa a3;
        Wa wa = a3;
        Wa wa2 = a3;
        super(iy.class);
        a3.H = true;
        wa2.h = 500.0;
        wa2.C = 500.0;
        wa.M = new gf_2(te_1.A, rd_2.M, false);
        wa.b = df_1.b;
        wa.c = df_1.b;
        a3.A = 0;
        a3.D = 0;
        a3.h /= a2;
        a3.C /= a2;
    }
}

