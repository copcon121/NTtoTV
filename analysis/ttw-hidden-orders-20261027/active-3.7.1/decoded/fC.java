/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import ttw.tradefinder.Ic;
import ttw.tradefinder.df_1;
import ttw.tradefinder.eC;
import ttw.tradefinder.er;
import ttw.tradefinder.lc_0;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

public class fC
extends wa_2<er> {
    public eC D;
    public int A;
    public df_1 C;
    public Color M;
    public lc_0 b;
    public Ic c;

    @Override
    public er E() {
        fC a2;
        er er2 = new er();
        new er().IsDefault = a2.b;
        fC fC2 = a2;
        er er3 = er2;
        fC fC3 = a2;
        er2.b = va.E(fC3.D);
        er3.c = va.E(fC3.c);
        er3.d = va.E(a2.b);
        er2.e = fC2.M;
        er2.f = va.E(fC2.C);
        er2.a = a2.A;
        return er2;
    }

    public fC() {
        a2(eC.H, Ic.b, Color.WHITE, lc_0.C, df_1.b, 12);
        fC a2;
    }

    public fC(eC a2, Ic a3, Color a4, lc_0 a5, df_1 a6, int a7) {
        fC a8;
        fC fC2 = a8;
        fC fC3 = a8;
        fC fC4 = a8;
        fC fC5 = a8;
        fC fC6 = a8;
        super(er.class);
        a8.D = eC.H;
        fC6.c = Ic.b;
        fC5.A = 12;
        fC6.b = lc_0.C;
        fC5.M = Color.WHITE;
        fC5.C = df_1.b;
        fC4.D = a2;
        fC4.c = a3;
        fC3.b = a5;
        fC3.M = a4;
        fC2.C = a6;
        fC2.A = a7;
    }

    @Override
    public void E(er a2) {
        er er2 = a2;
        a.b = (lc_0)er2.IsDefault;
        if (er2.a != 0) {
            a.A = a2.a;
        }
        if (a2.b != null) {
            a.D = va.E(a2.b);
        }
        if (a2.c != null) {
            a.c = va.E(a2.c);
        }
        if (a2.d != null) {
            a.b = va.E(a2.d);
        }
        if (a2.e != null) {
            a.M = a2.e;
        }
        if (a2.f != null) {
            a.C = va.E(a2.f);
        }
    }
}

