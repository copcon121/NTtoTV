/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.M;
import ttw.tradefinder.ec_0;
import ttw.tradefinder.gd_2;
import ttw.tradefinder.mb;
import ttw.tradefinder.pe_1;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.eb
 */
public class eb_0 {
    private final String b;
    private final M c;

    public mb E() {
        eb_0 a2;
        eb_0 eb_02 = a2;
        return new mb(eb_02.b, eb_02.c.E());
    }

    public static eb_0 E() {
        return new eb_0("name", new ec_0("value"));
    }

    public eb_0(String a2, M a3) {
        eb_0 a4;
        eb_0 eb_02 = a4;
        eb_02.b = a2;
        eb_02.c = a3;
    }
}

