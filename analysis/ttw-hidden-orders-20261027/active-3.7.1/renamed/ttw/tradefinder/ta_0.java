/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.g;
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.Ta
 */
public class ta_0
extends wa_2<g> {
    public boolean M;
    public boolean c;

    @Override
    public void E(g a2) {
        ta_0 a3;
        ta_0 ta_02 = a3;
        g g2 = a2;
        a3.b = g2.IsDefault;
        ta_02.c = g2.a;
        ta_02.M = a2.b;
    }

    public ta_0() {
        a2(true, true, false, false);
        ta_0 a2;
    }

    @Override
    public g E() {
        ta_0 a2;
        g g2 = new g();
        new g().IsDefault = a2.b;
        g2.a = a2.c;
        g2.b = a2.M;
        return g2;
    }

    public ta_0(boolean a2, boolean a3, boolean a4, boolean a5) {
        ta_0 a6;
        ta_0 ta_02 = a6;
        ta_0 ta_03 = a6;
        super(g.class);
        ta_03.c = true;
        ta_03.M = true;
        ta_02.c = a2;
        ta_02.M = a3;
    }
}

