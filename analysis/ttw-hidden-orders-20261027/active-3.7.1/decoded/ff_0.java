/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ff_1;
import ttw.tradefinder.fg;
import ttw.tradefinder.sf_1;
import ttw.tradefinder.ud_1;

/*
 * Renamed from ttw.tradefinder.ff
 */
public class ff_0 {
    private final fg c;

    public /* synthetic */ ud_1 E(ff_1 a2, sf_1 a3) {
        ff_0 a4;
        return new ud_1(a4.c, a2, a3);
    }

    public /* synthetic */ ud_1 E(sf_1 a2) {
        ff_0 a3;
        return new ud_1(a3.c, ff_1.w, a2);
    }

    public /* synthetic */ ff_0(fg a2) {
        ff_0 a3;
        a3.c = a2;
    }

    public /* synthetic */ ud_1 E(ff_1 a2) {
        ff_0 a3;
        return new ud_1(a3.c, a2, sf_1.G);
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (3 ^ 5) << 4 ^ 3 << 1;
        int cfr_ignored_0 = 3 << 3 ^ 3;
        int n5 = n3;
        int n6 = 4 << 4 ^ 5;
        while (n5 >= 0) {
            int n7 = n3--;
            a2[n7] = (char)(((String)object2).charAt(n7) ^ n6);
            if (n3 < 0) break;
            int n8 = n3--;
            a2[n8] = (char)(((String)object2).charAt(n8) ^ n4);
            n5 = n3;
        }
        return new String((char[])a2);
    }

    public static /* synthetic */ ud_1 E() {
        return new ud_1(null, ff_1.y, sf_1.w);
    }
}

