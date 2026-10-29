/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ae_2;
import ttw.tradefinder.df_1;
import ttw.tradefinder.el;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.Za
 */
public class za_0
extends wa_2<el> {
    public df_1 E;
    public boolean j;
    public double a;
    public double h;
    public df_1 H;
    public gf_2 D;
    public ae_2 A;
    public ae_2 C;
    public boolean M;
    public df_1 c;

    public za_0(double a2) {
        za_0 a3;
        za_0 za_02 = a3;
        za_0 za_03 = a3;
        za_0 za_04 = a3;
        za_0 za_05 = a3;
        za_0 za_06 = a3;
        super(el.class);
        za_06.M = true;
        za_06.a = 300.0;
        za_05.E = df_1.c;
        za_04.j = true;
        za_05.D = new gf_2(te_1.A, rd_2.M, false);
        za_04.c = df_1.b;
        za_03.H = df_1.b;
        za_03.h = 2.0;
        za_02.C = ae_2.c;
        za_02.A = ae_2.c;
        za_02.a /= a2;
        za_02.h /= a2;
    }

    @Override
    public void E(el a2) {
        za_0 a3;
        el el2 = a2;
        za_0 za_02 = a3;
        el el3 = a2;
        a3.b = a2.IsDefault;
        a3.M = el3.d;
        za_02.a = el3.b;
        za_02.j = a2.f;
        a3.h = el2.c;
        if (el2.a != null) {
            a3.C = va.E(a2.a);
        }
        if (a2.e != null) {
            a3.A = va.E(a2.e);
        }
        if (a2.g != null) {
            a3.c = va.E(a2.g);
        }
        if (a2.h != null) {
            a3.H = va.E(a2.h);
        }
        if (a2.o != null) {
            a3.E = va.E(a2.o);
        }
        if (a2.k != null) {
            a3.D.E(a2.k);
        }
    }

    @Override
    public el E() {
        za_0 a2;
        el el2 = new el();
        new el().IsDefault = a2.b;
        za_0 za_02 = a2;
        el el3 = el2;
        za_0 za_03 = a2;
        el el4 = el2;
        za_0 za_04 = a2;
        el2.d = a2.M;
        el2.b = za_04.a;
        el4.f = za_04.j;
        el4.c = a2.h;
        el2.a = va.E(za_03.C);
        el3.e = va.E(za_03.A);
        el3.g = va.E(a2.c);
        el2.h = va.E(za_02.H);
        el2.o = va.E(za_02.E);
        el2.k = a2.D.E();
        return el2;
    }
}

