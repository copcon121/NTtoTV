/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.dE;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.sf_1;
import ttw.tradefinder.ze;

public class Ue {
    private final dE c;

    public /* synthetic */ Ue(dE a2) {
        Ue a3;
        a3.c = a2;
    }

    public /* synthetic */ ze E(sf_1 a2) {
        Ue a3;
        return new ze(a3.c, ff_1.w, a2);
    }

    public /* synthetic */ ze E(ff_1 a2, sf_1 a3) {
        Ue a4;
        return new ze(a4.c, a2, a3);
    }

    public static /* synthetic */ ze E() {
        return new ze(null, ff_1.y, sf_1.w);
    }

    public /* synthetic */ ze E(ff_1 a2) {
        Ue a3;
        return new ze(a3.c, a2, sf_1.G);
    }
}

