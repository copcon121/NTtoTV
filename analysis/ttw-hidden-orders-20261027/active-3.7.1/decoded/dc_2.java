/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ej;
import ttw.tradefinder.ja_0;
import ttw.tradefinder.kc_1;
import ttw.tradefinder.mb_2;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.dC
 */
public class dc_2
extends wa_2<ej> {
    public kc_1 C;
    public ja_0 M;
    public mb_2 b;
    public int c;

    @Override
    public ej E() {
        dc_2 a2;
        ej ej2 = new ej();
        new ej().IsDefault = a2.b;
        dc_2 dc_22 = a2;
        ej2.a = a2.c;
        ej2.b = va.E(dc_22.C);
        ej2.c = va.E(dc_22.M);
        ej2.d = va.E(a2.b);
        return ej2;
    }

    @Override
    public void E(ej a2) {
        ej ej2 = a2;
        a.b = (mb_2)ej2.IsDefault;
        if (ej2.a != 0) {
            a.c = a2.a;
        }
        if (a2.b != null) {
            a.C = va.E(a2.b);
        }
        if (a2.c != null) {
            a.M = va.E(a2.c);
        }
        if (a2.d != null) {
            a.b = va.E(a2.d);
        }
    }

    public dc_2(kc_1 a2, ja_0 a3, mb_2 a4, int a5) {
        dc_2 a6;
        dc_2 dc_22 = a6;
        dc_2 dc_23 = a6;
        dc_2 dc_24 = a6;
        super(ej.class);
        a6.C = kc_1.M;
        dc_24.M = ja_0.c;
        dc_24.b = mb_2.c;
        dc_24.c = 10;
        dc_23.C = a2;
        dc_23.M = a3;
        dc_22.b = a4;
        dc_22.c = a5;
    }

    public dc_2() {
        a2(kc_1.M, ja_0.c, mb_2.c, 10);
        dc_2 a2;
    }
}

