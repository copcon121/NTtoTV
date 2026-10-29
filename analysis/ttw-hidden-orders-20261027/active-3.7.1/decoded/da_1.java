/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.cC;
import ttw.tradefinder.db_0;
import ttw.tradefinder.eq;
import ttw.tradefinder.ic_0;
import ttw.tradefinder.la_1;
import ttw.tradefinder.va;
import ttw.tradefinder.wB;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.xa_1;

/*
 * Renamed from ttw.tradefinder.DA
 */
public class da_1
extends wa_2<eq> {
    public ic_0 a;
    public db_0 h;
    public int H;
    public int D;
    public la_1 A;
    public wB C;
    public cC M;
    public int b;
    public xa_1 c;

    @Override
    public void E(eq a2) {
        eq eq2 = a2;
        a.b = eq2.IsDefault ? 1 : 0;
        if (eq2.b != null) {
            a.h = va.E(a2.b);
        }
        if (a2.c != null) {
            a.c = va.E(a2.c);
        }
        if (a2.d != null) {
            a.C = va.E(a2.d);
        }
        if (a2.e != null) {
            a.A = va.E(a2.e);
        }
        if (a2.f != null) {
            a.M = va.E(a2.f);
        }
        if (a2.i != null) {
            a.a = va.E(a2.i);
        }
        if (a2.g != 0) {
            a.H = a2.g;
        }
        if (a2.h != 0) {
            a.b = a2.h;
        }
        if (a2.j != 0) {
            a.D = a2.j;
        }
    }

    public da_1(db_0 a2, xa_1 a3, wB a4, la_1 a5, cC a6, ic_0 a7, int a8, int a9, int a10) {
        da_1 a11;
        da_1 da_12 = a11;
        da_1 da_13 = a11;
        da_1 da_14 = a11;
        da_1 da_15 = a11;
        da_1 da_16 = a11;
        da_1 da_17 = a11;
        super(eq.class);
        a11.h = db_0.b;
        a11.c = xa_1.b;
        a11.C = wB.M;
        a11.A = la_1.c;
        a11.M = cC.b;
        a11.a = ic_0.b;
        da_17.H = 10;
        da_17.b = 70;
        da_16.D = 255;
        da_16.h = a2;
        da_15.c = a3;
        da_15.C = a4;
        da_14.A = a5;
        da_14.M = a6;
        da_13.H = a8;
        da_13.b = a9;
        da_12.a = a7;
        da_12.D = a10;
    }

    @Override
    public eq E() {
        da_1 a2;
        eq eq2 = new eq();
        new eq().IsDefault = a2.b;
        da_1 da_12 = a2;
        eq eq3 = eq2;
        da_1 da_13 = a2;
        eq eq4 = eq2;
        da_1 da_14 = a2;
        eq2.b = va.E(da_14.h);
        eq4.c = va.E(da_14.c);
        eq4.d = va.E(a2.C);
        eq2.e = va.E(da_13.A);
        eq3.f = va.E(da_13.M);
        eq3.i = va.E(a2.a);
        eq2.g = da_12.H;
        eq2.h = da_12.b;
        eq2.j = a2.D;
        return eq2;
    }

    public da_1() {
        a2(db_0.b, xa_1.b, wB.M, la_1.c, cC.C, ic_0.b, 10, 70, 255);
        da_1 a2;
    }
}

