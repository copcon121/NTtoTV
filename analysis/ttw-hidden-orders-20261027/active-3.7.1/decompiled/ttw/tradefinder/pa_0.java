/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.df_1;
import ttw.tradefinder.fu;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.Pa
 */
public class pa_0
extends wa_2<fu> {
    public df_1 h;
    public int H;
    public df_1 D;
    public df_1 A;
    public df_1 C;
    public boolean M;
    public gf_2 b;
    public double c;

    @Override
    public fu E() {
        pa_0 a2;
        fu fu2 = new fu();
        new fu().IsDefault = a2.b;
        pa_0 pa_02 = a2;
        fu fu3 = fu2;
        pa_0 pa_03 = a2;
        fu fu4 = fu2;
        fu4.b = a2.M;
        fu4.d = a2.c;
        fu2.e = pa_03.H;
        fu3.c = pa_03.b.E();
        fu3.f = va.E(a2.D);
        fu2.h = va.E(pa_02.A);
        fu2.g = va.E(pa_02.C);
        fu2.a = va.E(a2.h);
        return fu2;
    }

    public pa_0(double a2) {
        pa_0 a3;
        pa_0 pa_02 = a3;
        super(fu.class);
        a3.M = true;
        a3.b = new gf_2(te_1.A, rd_2.C, false);
        pa_02.c = 1000.0;
        a3.H = 9;
        pa_02.D = df_1.b;
        a3.A = df_1.b;
        a3.C = df_1.b;
        a3.h = df_1.b;
        a3.c /= a2;
    }

    @Override
    public void E(fu a2) {
        pa_0 a3;
        fu fu2 = a2;
        pa_0 pa_02 = a3;
        fu fu3 = a2;
        a3.b = (gf_2)fu3.IsDefault;
        pa_02.M = fu3.b;
        pa_02.c = a2.d;
        a3.H = fu2.e;
        if (fu2.c != null) {
            a3.b.E(a2.c);
        }
        if (a2.f != null) {
            a3.D = va.E(a2.f);
        }
        if (a2.h != null) {
            a3.A = va.E(a2.h);
        }
        if (a2.g != null) {
            a3.C = va.E(a2.g);
        }
        if (a2.a != null) {
            a3.h = va.E(a2.a);
        }
    }
}

