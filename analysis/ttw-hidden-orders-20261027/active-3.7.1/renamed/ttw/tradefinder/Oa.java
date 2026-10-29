/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.df_1;
import ttw.tradefinder.et;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

public class Oa
extends wa_2<et> {
    public df_1 f;
    public df_1 F;
    public double J;
    public int G;
    public gf_2 d;
    public int i;
    public int e;
    public int k;
    public gf_2 B;
    public double K;
    public df_1 E;
    public boolean j;
    public boolean a;
    public boolean h;
    public int H;
    public int D;
    public df_1 A;
    public int C;
    public int M;
    public int b;
    public int c;

    @Override
    public et E() {
        Oa a2;
        et et2 = new et();
        new et().IsDefault = a2.b;
        Oa oa = a2;
        et et3 = et2;
        Oa oa2 = a2;
        et et4 = et2;
        Oa oa3 = a2;
        et et5 = et2;
        Oa oa4 = a2;
        et et6 = et2;
        Oa oa5 = a2;
        et et7 = et2;
        Oa oa6 = a2;
        et et8 = et2;
        Oa oa7 = a2;
        et2.b = oa7.J;
        et8.c = oa7.j;
        et8.e = a2.b;
        et2.f = oa6.i;
        et7.o = oa6.K;
        et7.h = a2.a;
        et2.j = oa5.C;
        et6.k = oa5.M;
        et6.l = a2.H;
        et2.m = oa4.D;
        et5.n = oa4.G;
        et5.q = a2.h;
        et2.a = oa3.e;
        et4.t = oa3.k;
        et4.u = a2.c;
        et2.d = va.E(oa2.A);
        et3.r = va.E(oa2.f);
        et3.i = va.E(a2.E);
        et2.s = va.E(oa.F);
        et2.g = oa.B.ttw_tradefinder_go_E();
        et2.p = a2.d.ttw_tradefinder_go_E();
        return et2;
    }

    @Override
    public void E(et a2) {
        Oa a3;
        et et2 = a2;
        Oa oa = a3;
        et et3 = a2;
        Oa oa2 = a3;
        et et4 = a2;
        Oa oa3 = a3;
        et et5 = a2;
        Oa oa4 = a3;
        et et6 = a2;
        Oa oa5 = a3;
        et et7 = a2;
        a3.b = et7.IsDefault ? 1 : 0;
        oa5.J = et7.b;
        oa5.j = a2.c;
        a3.b = et6.e;
        oa4.i = et6.f;
        oa4.K = a2.o;
        a3.a = et5.h;
        oa3.C = et5.j;
        oa3.M = a2.k;
        a3.H = et4.l;
        oa2.D = et4.m;
        oa2.G = a2.n;
        a3.h = et3.q;
        oa.e = et3.a;
        oa.k = a2.t;
        a3.c = et2.u;
        if (et2.d != null) {
            a3.A = va.E(a2.d);
        }
        if (a2.r != null) {
            a3.f = va.E(a2.r);
        }
        if (a2.i != null) {
            a3.E = va.E(a2.i);
        }
        if (a2.s != null) {
            a3.F = va.E(a2.s);
        }
        if (a2.g != null) {
            a3.B.E(a2.g);
        }
        if (a2.p != null) {
            a3.d.E(a2.p);
        }
    }

    public Oa(double a2) {
        Oa a3;
        Oa oa = a3;
        Oa oa2 = a3;
        Oa oa3 = a3;
        Oa oa4 = a3;
        Oa oa5 = a3;
        Oa oa6 = a3;
        Oa oa7 = a3;
        Oa oa8 = a3;
        super(et.class);
        oa8.J = 300.0;
        oa7.j = true;
        oa8.A = df_1.b;
        oa7.f = df_1.b;
        oa7.B = new gf_2(te_1.A, rd_2.c, false);
        oa6.b = 20;
        oa6.i = 80;
        oa5.K = 500.0;
        oa5.a = true;
        oa5.E = df_1.b;
        oa4.F = df_1.b;
        oa4.d = new gf_2(te_1.A, rd_2.c, false);
        oa4.C = 1;
        oa3.M = 10;
        oa3.H = 1;
        oa2.D = 10;
        oa2.G = 10;
        oa.h = true;
        oa.e = 1;
        a3.k = 10;
        a3.c = 10;
        a3.J /= a2;
        a3.K /= a2;
    }
}

