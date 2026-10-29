/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
 */
package ttw.tradefinder;

import java.awt.Font;
import java.util.Arrays;
import org.apache.commons.lang3.tuple.Pair;
import ttw.tradefinder.aa_1;
import ttw.tradefinder.hc_0;
import ttw.tradefinder.he_1;
import ttw.tradefinder.ra_1;

public class Bd
extends aa_1 {
    private static final int b = 4;
    private static final int c = 12;

    public Bd(String a2, String a3) {
        super(Arrays.asList(Pair.of((Object)a3, (Object)he_1.c), Pair.of((Object)hc_0.E("d\u000ed"), (Object)he_1.H), Pair.of((Object)a2, (Object)he_1.j)), 4, 0, 0, new Font(ra_1.E("5 \u001d3\u0018"), 1, 12));
        Bd a4;
    }

    @Override
    public void E(double a2) {
        Bd a3;
        a3.E((float)(a2 * 12.0));
    }
}

