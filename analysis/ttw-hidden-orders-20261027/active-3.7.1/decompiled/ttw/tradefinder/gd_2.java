/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.wd_2;

/*
 * Renamed from ttw.tradefinder.gD
 */
public class gd_2 {
    private boolean D;
    private double A;
    private long C;
    private int M;
    private boolean b;
    private double c;

    public /* synthetic */ gd_2(double a2) {
        gd_2 a3;
        gd_2 gd_22 = a3;
        gd_2 gd_23 = a3;
        a3.A = 0.0;
        gd_23.c = 0.0;
        gd_23.C = 0L;
        gd_22.M = 0;
        gd_22.D = false;
        a3.b = true;
        a3.c = a3.A = a2;
    }

    public /* synthetic */ void E(double a2) {
        gd_2 a3;
        gd_2 gd_22;
        a3.A = a2;
        if (gd_22.A < a3.c * 0.8) {
            a3.b = true;
        }
        a3.c = Math.max(a3.c, a3.A);
        a3.D = false;
    }

    public /* synthetic */ wd_2 E(long a2, double a3, int a4) {
        gd_2 a5;
        double d2;
        wd_2 wd_22 = null;
        double d3 = Math.abs(a3);
        if (d2 > a5.c) {
            a5.c = d3;
            a5.C = a2;
            a5.M = a4;
            if (a5.b) {
                gd_2 gd_22 = a5;
                gd_22.b = false;
                gd_22.D = true;
            }
        }
        if (d3 < a5.c * 0.9 && a5.D) {
            gd_2 gd_23;
            boolean bl;
            a5.D = false;
            if (a3 <= 0.0) {
                bl = true;
                gd_23 = a5;
            } else {
                bl = false;
                gd_23 = a5;
            }
            gd_2 gd_24 = a5;
            wd_22 = new wd_2(a2, bl, gd_23.A, a5.c, gd_24.M, gd_24.C);
        }
        if (d3 < Math.max(a5.A * 0.8, a5.c * 0.7)) {
            gd_2 gd_25 = a5;
            gd_2 gd_26 = a5;
            gd_26.c = Math.max(d3 * 1.3, a5.A);
            gd_26.C = a2;
            gd_25.M = a4;
            gd_25.b = true;
        }
        return wd_22;
    }

    public /* synthetic */ void E() {
        gd_2 a2;
        gd_2 gd_22 = a2;
        gd_2 gd_23 = a2;
        gd_23.D = false;
        gd_23.b = true;
        gd_22.c = 0.0;
        gd_22.C = 0L;
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 2 << 3 ^ 3;
        int cfr_ignored_0 = 5 << 4 ^ 2 << 1;
        int n5 = n3;
        int n6 = 5 << 4 ^ 1;
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
}

