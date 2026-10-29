/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Font;
import ttw.tradefinder.ae_1;
import ttw.tradefinder.he_1;
import ttw.tradefinder.jc;

/*
 * Renamed from ttw.tradefinder.Db
 */
public class db_1
extends jc {
    private static final int C = 2;
    private static final int M = 6;
    private static final int b = 12;
    private static final int c = 6;

    public db_1(double a2, String a3) {
        super(a3, 6, 6, 2, 6, 0, 0, new Font("Arial", 1, 12), a2 == 0.0 ? he_1.H : (a2 > 0.0 ? he_1.j : he_1.c));
        db_1 a4;
    }

    @Override
    public void E(double a2) {
        db_1 a3;
        a3.E((float)(a2 * 12.0));
    }
}

