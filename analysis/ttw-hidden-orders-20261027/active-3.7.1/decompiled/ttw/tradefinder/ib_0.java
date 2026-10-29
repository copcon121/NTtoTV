/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import ttw.tradefinder.Ad;
import ttw.tradefinder.a;
import ttw.tradefinder.hd;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.za_1;

/*
 * Renamed from ttw.tradefinder.Ib
 */
public class ib_0
extends wa_2<a> {
    public hd A;
    public Color C;
    public Ad M;
    public int b;
    public za_1 c;

    public ib_0() {
        a2(Ad.b, hd.M, Color.WHITE, za_1.c, 60);
        ib_0 a2;
    }

    public ib_0(Ad a2, hd a3, Color a4, za_1 a5, int a6) {
        ib_0 a7;
        ib_0 ib_02 = a7;
        ib_0 ib_03 = a7;
        ib_0 ib_04 = a7;
        ib_0 ib_05 = a7;
        super(a.class);
        ib_05.M = Ad.b;
        ib_05.A = hd.M;
        ib_05.b = 60;
        ib_04.c = za_1.c;
        ib_04.C = Color.WHITE;
        ib_04.M = a2;
        ib_03.A = a3;
        ib_03.b = a6;
        ib_02.C = a4;
        ib_02.c = a5;
    }

    @Override
    public void E(a a2) {
        a a3 = a2;
        a.b = a3.IsDefault ? 1 : 0;
        if (a3.a != null) {
            a.M = va.E(a2.a);
        }
        if (a2.b != null) {
            a.A = va.E(a2.b);
        }
        if (a2.c != 0) {
            a.b = a2.c;
        }
        if (a2.d != null) {
            a.c = va.E(a2.d);
        }
        if (a2.e != null) {
            a.C = a2.e;
        }
    }

    @Override
    public a E() {
        ib_0 a2;
        a a3 = new a();
        new a().IsDefault = a2.b;
        ib_0 ib_02 = a2;
        a a4 = a3;
        a4.a = va.E(a2.M);
        a4.b = va.E(a2.A);
        a3.c = ib_02.b;
        a3.d = va.E(ib_02.c);
        a3.e = a2.C;
        return a3;
    }
}

