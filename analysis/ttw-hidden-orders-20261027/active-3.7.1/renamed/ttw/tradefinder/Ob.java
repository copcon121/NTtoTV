/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.df_1;
import ttw.tradefinder.fR;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

public class Ob
extends wa_2<fR> {
    public df_1 h;
    public double H;
    public double D;
    public gf_2 A;
    public df_1 C;
    public boolean M;
    public int c;

    @Override
    public fR E() {
        Ob a2;
        fR fR2 = new fR();
        new fR().IsDefault = a2.b;
        Ob ob = a2;
        fR fR3 = fR2;
        Ob ob2 = a2;
        fR2.b = a2.M;
        fR2.d = ob2.H;
        fR3.g = ob2.c;
        fR3.e = a2.D;
        fR2.c = ob.A.ttw_tradefinder_go_E();
        fR2.f = va.E(ob.h);
        fR2.h = va.E(a2.C);
        return fR2;
    }

    public Ob(double a2) {
        Ob a3;
        Ob ob = a3;
        Ob ob2 = a3;
        super(fR.class);
        a3.M = true;
        ob2.A = new gf_2(te_1.A, rd_2.M, false);
        ob2.H = 1000.0;
        ob.c = 2;
        ob.D = 1.0;
        a3.h = df_1.b;
        a3.C = df_1.b;
        a3.H /= a2;
    }

    @Override
    public void E(fR a2) {
        Ob a3;
        fR fR2 = a2;
        Ob ob = a3;
        fR fR3 = a2;
        a3.b = a2.IsDefault;
        a3.M = fR3.b;
        ob.H = fR3.d;
        ob.c = a2.g;
        a3.D = fR2.e;
        if (fR2.c != null) {
            a3.A.E(a2.c);
        }
        if (a2.f != null) {
            a3.h = va.E(a2.f);
        }
        if (a2.h != null) {
            a3.C = va.E(a2.h);
        }
    }
}

