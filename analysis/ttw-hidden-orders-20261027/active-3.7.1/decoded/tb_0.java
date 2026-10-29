/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.c;
import ttw.tradefinder.eb_1;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.Tb
 */
public class tb_0
extends wa_2<c> {
    public int b;
    public eb_1 c;

    @Override
    public c E() {
        tb_0 a2;
        c c2 = new c();
        new c().IsDefault = a2.b;
        c2.a = a2.b;
        c2.b = va.E(a2.c);
        return c2;
    }

    @Override
    public void E(c a2) {
        c c2 = a2;
        a.b = a2.IsDefault ? 1 : 0;
        a.b = c2.a;
        if (c2.b != null) {
            a.c = va.E(a2.b);
        }
    }

    public tb_0(int a2, eb_1 a3) {
        tb_0 a4;
        tb_0 tb_02 = a4;
        super(c.class);
        a4.b = 3;
        a4.c = eb_1.M;
        tb_02.b = a2;
        tb_02.c = a3;
    }

    public tb_0() {
        a2(3, eb_1.M);
        tb_0 a2;
    }
}

