/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.d;
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.Ra
 */
public class ra_0
extends wa_2<d> {
    public boolean c;

    public ra_0() {
        a2(false);
        ra_0 a2;
    }

    public ra_0(boolean a2) {
        ra_0 a3;
        ra_0 ra_02 = a3;
        super(d.class);
        ra_02.c = false;
        ra_02.c = a2;
    }

    @Override
    public d E() {
        ra_0 a2;
        d d2 = new d();
        new d().IsDefault = a2.b;
        d2.a = a2.c;
        return d2;
    }

    @Override
    public void E(d a2) {
        ra_0 a3;
        ra_0 ra_02 = a3;
        ra_02.b = a2.IsDefault;
        ra_02.c = a2.a;
    }
}

