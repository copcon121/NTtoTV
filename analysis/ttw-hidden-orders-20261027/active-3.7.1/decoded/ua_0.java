/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import ttw.tradefinder.df_1;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.he_1;
import ttw.tradefinder.in;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.uc_2;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Ua
 */
public class ua_0
extends wa_2<in> {
    public boolean j;
    public uc_2 a;
    public df_1 h;
    public int H;
    public df_1 D;
    public df_1 A;
    public gf_2 C;
    public int M;
    public Color b;
    public Color c;

    @Override
    public in E() {
        ua_0 a2;
        in in2 = new in();
        new in().IsDefault = a2.b;
        ua_0 ua_02 = a2;
        in in3 = in2;
        ua_0 ua_03 = a2;
        in in4 = in2;
        ua_0 ua_04 = a2;
        in2.c = a2.H;
        in2.d = ua_04.M;
        in4.b = ua_04.j;
        in4.e = a2.c;
        in2.k = ua_03.b;
        in3.f = va.E(ua_03.a);
        in3.g = va.E(a2.h);
        in2.h = va.E(ua_02.A);
        in2.j = va.E(ua_02.D);
        in2.i = a2.C.E();
        return in2;
    }

    public int E(ze_2 a2, double a3) {
        ua_0 a4;
        return (int)(a3 * a2.A * ((double)a4.H / 100.0));
    }

    public ua_0() {
        ua_0 a2;
        ua_0 ua_02 = a2;
        ua_0 ua_03 = a2;
        super(in.class);
        a2.j = true;
        ua_03.H = 20;
        ua_02.M = 10;
        ua_03.c = he_1.K;
        ua_02.b = he_1.a;
        ua_02.a = uc_2.M;
        ua_02.C = new gf_2(te_1.A, rd_2.M, false);
        ua_02.h = df_1.b;
        ua_02.A = df_1.b;
        ua_02.D = df_1.b;
    }

    @Override
    public void E(in a2) {
        ua_0 a3;
        in in2 = a2;
        ua_0 ua_02 = a3;
        in in3 = a2;
        a3.b = (Color)in3.IsDefault;
        ua_02.H = in3.c;
        ua_02.M = a2.d;
        a3.j = in2.b;
        if (in2.g != null) {
            a3.h = va.E(a2.g);
        }
        if (a2.h != null) {
            a3.A = va.E(a2.h);
        }
        if (a2.j != null) {
            a3.D = va.E(a2.j);
        }
        if (a2.i != null) {
            a3.C.E(a2.i);
        }
        if (a2.e != null) {
            a3.c = a2.e;
        }
        if (a2.k != null) {
            a3.b = a2.k;
        }
        if (a2.f != null) {
            a3.a = va.E(a2.f);
        }
    }
}

