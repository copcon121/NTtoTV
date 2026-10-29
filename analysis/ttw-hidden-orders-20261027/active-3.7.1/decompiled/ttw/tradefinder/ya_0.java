/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.e;
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.ya
 */
public class ya_0
extends wa_2<e> {
    public boolean M;
    public boolean c;

    @Override
    public e E() {
        ya_0 a2;
        e e2 = new e();
        new e().IsDefault = a2.b;
        e2.a = a2.M;
        e2.b = a2.c;
        return e2;
    }

    public ya_0() {
        a2(true, false);
        ya_0 a2;
    }

    @Override
    public void E(e a2) {
        ya_0 a3;
        ya_0 ya_02 = a3;
        e e2 = a2;
        a3.b = e2.IsDefault;
        ya_02.M = e2.a;
        ya_02.c = a2.b;
    }

    public ya_0(boolean a2, boolean a3) {
        ya_0 a4;
        ya_0 ya_02 = a4;
        ya_0 ya_03 = a4;
        super(e.class);
        ya_03.M = true;
        ya_03.c = false;
        ya_02.M = a2;
        ya_02.c = a3;
    }
}

