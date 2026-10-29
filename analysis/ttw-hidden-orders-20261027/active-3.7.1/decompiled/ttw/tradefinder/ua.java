/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.df_1;
import ttw.tradefinder.ep;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

public class ua
extends wa_2<ep> {
    public boolean E;
    public int j;
    public double a;
    public boolean h;
    public gf_2 H;
    public double D;
    public double A;
    public boolean C;
    public df_1 M;
    public df_1 b;
    public double c;

    @Override
    public void E(ep a2) {
        ua a3;
        ep ep2 = a2;
        ua ua2 = a3;
        ep ep3 = a2;
        ua ua3 = a3;
        ep ep4 = a2;
        ua ua4 = a3;
        ua4.b = (df_1)a2.IsDefault;
        ua4.C = a2.b;
        a3.D = ep4.d;
        ua3.a = ep4.e;
        ua3.j = a2.f;
        a3.E = ep3.k;
        ua2.A = ep3.g;
        ua2.h = a2.i;
        a3.c = ep2.j;
        if (ep2.c != null) {
            a3.H.E(a2.c);
        }
        if (a2.h != null) {
            a3.M = va.E(a2.h);
        }
        if (a2.l != null) {
            a3.b = va.E(a2.l);
        }
    }

    @Override
    public ep E() {
        ua a2;
        ep ep2 = new ep();
        new ep().IsDefault = a2.b;
        ua ua2 = a2;
        ep ep3 = ep2;
        ua ua3 = a2;
        ep ep4 = ep2;
        ua ua4 = a2;
        ep ep5 = ep2;
        ep5.b = a2.C;
        ep5.d = a2.D;
        ep2.e = ua4.a;
        ep4.f = ua4.j;
        ep4.k = a2.E;
        ep2.g = ua3.A;
        ep3.i = ua3.h;
        ep3.j = a2.c;
        ep2.c = ua2.H.E();
        ep2.h = va.E(ua2.M);
        ep2.l = va.E(a2.b);
        return ep2;
    }

    public ua(double a2) {
        ua a3;
        ua ua2 = a3;
        ua ua3 = a3;
        ua ua4 = a3;
        ua ua5 = a3;
        super(ep.class);
        a3.C = true;
        ua5.H = new gf_2(te_1.A, rd_2.C, false);
        ua5.D = 800.0;
        ua4.a = 1.0;
        ua4.j = 8;
        ua3.h = true;
        ua3.c = 10.0;
        ua2.E = false;
        ua2.A = 4.0;
        a3.M = df_1.b;
        a3.b = df_1.b;
        a3.D /= a2;
    }
}

