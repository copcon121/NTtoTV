/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.af_1;
import ttw.tradefinder.pe_2;

/*
 * Renamed from ttw.tradefinder.EE
 */
public class ee_1
extends af_1 {
    private long A;
    private pe_2 C;
    private long M;
    private final long b;
    private pe_2 c;

    public void E(long a2, boolean a3, int a4) {
        ee_1 a5;
        if (a3) {
            if (a2 > a5.M) {
                ee_1 ee_12 = a5;
                a5.M = a2 + a5.b;
                ee_12.c = new pe_2(a4, a3);
                ee_12.E(ee_12.M, a5.c);
                return;
            }
            a5.c.E(a4);
            return;
        }
        if (a2 > a5.A) {
            ee_1 ee_13 = a5;
            a5.A = a2 + a5.b;
            ee_13.C = new pe_2(a4, a3);
            ee_13.E(ee_13.A, a5.C);
            return;
        }
        a5.C.E(a4);
    }

    public ee_1(long a2, int a3, int a4, boolean a5) {
        ee_1 a6;
        ee_1 ee_12 = a6;
        ee_1 ee_13 = a6;
        super(a3, a4, a5);
        ee_13.M = 0L;
        ee_13.A = 0L;
        ee_13.c = new pe_2();
        ee_12.C = new pe_2();
        ee_12.b = a2;
    }
}

