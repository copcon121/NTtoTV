/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;

/*
 * Renamed from ttw.tradefinder.QD
 */
public class qd_2 {
    public String C;
    public static qd_2 M = qd_2.E();
    public rd_2 b;
    public te_1 c;

    public qd_2(te_1 a2, rd_2 a3, String a4) {
        qd_2 a5;
        qd_2 qd_22 = a5;
        qd_2 qd_23 = a5;
        a5.c = te_1.A;
        a5.b = rd_2.H;
        qd_23.C = "";
        qd_23.c = a2;
        qd_22.C = a4;
        qd_22.b = a3;
    }

    public qd_2(te_1 a2, String a3) {
        a4(a2, rd_2.H, a3);
        qd_2 a4;
    }

    public qd_2(te_1 a2, rd_2 a3) {
        a4(a2, a3, "");
        qd_2 a4;
    }

    private static /* synthetic */ qd_2 E() {
        return new qd_2(te_1.A, rd_2.H, "");
    }
}

