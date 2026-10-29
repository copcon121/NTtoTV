/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.wd_2;

/*
 * Renamed from ttw.tradefinder.AE
 */
public class ae_1 {
    private double H;
    private long D;
    private double A;
    private boolean C;
    private double M;
    private boolean b;
    private int c;

    public /* synthetic */ void E(double a2) {
        ae_1 a3;
        ae_1 ae_12;
        a3.H = a2;
        if (ae_12.H < a3.M * 0.8) {
            a3.C = true;
        }
        a3.M = Math.max(a3.M, a3.H);
        a3.b = false;
    }

    public /* synthetic */ wd_2 E(long a2, double a3, int a4) {
        double d2;
        ae_1 a5;
        if (Double.isNaN(a5.A)) {
            a5.A = a3;
        }
        wd_2 wd_22 = null;
        double d3 = Math.abs(a3);
        if (d2 > a5.M) {
            a5.M = d3;
            a5.D = a2;
            a5.c = a4;
            if (a5.C) {
                ae_1 ae_12 = a5;
                ae_12.C = false;
                ae_12.b = true;
            }
        }
        if (d3 < a5.M * 0.9 && a5.b) {
            ae_1 ae_13;
            boolean bl;
            a5.b = false;
            if (a3 < 0.0) {
                bl = true;
                ae_13 = a5;
            } else {
                bl = false;
                ae_13 = a5;
            }
            ae_1 ae_14 = a5;
            wd_22 = new wd_2(a2, bl, ae_13.H, a5.M, ae_14.c, ae_14.D);
        }
        if (a3 > 0.0 && a5.A <= 0.0 || a3 < 0.0 && a5.A >= 0.0) {
            if (a5.b) {
                ae_1 ae_15;
                boolean bl;
                if (a5.A < 0.0) {
                    bl = true;
                    ae_15 = a5;
                } else {
                    bl = false;
                    ae_15 = a5;
                }
                ae_1 ae_16 = a5;
                wd_22 = new wd_2(a2, bl, ae_15.H, a5.M, ae_16.c, ae_16.D);
            }
            ae_1 ae_17 = a5;
            ae_1 ae_18 = a5;
            ae_18.M = Math.max(d3 * 1.3, a5.H);
            ae_18.D = a2;
            ae_17.c = a4;
            ae_17.C = true;
            a5.b = false;
        }
        a5.A = a3;
        return wd_22;
    }

    public /* synthetic */ void E() {
        ae_1 a2;
        ae_1 ae_12 = a2;
        ae_12.b = false;
        ae_12.C = true;
        a2.M = a2.H;
        a2.D = 0L;
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 4;
        int cfr_ignored_0 = 4 << 4 ^ (2 ^ 5) << 1;
        int n5 = n3;
        int n6 = 4 << 3 ^ 1;
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

    public /* synthetic */ ae_1(double a2) {
        ae_1 a3;
        ae_1 ae_12 = a3;
        ae_1 ae_13 = a3;
        ae_1 ae_14 = a3;
        ae_14.H = 0.0;
        ae_14.A = Double.NaN;
        ae_13.M = 0.0;
        ae_13.D = 0L;
        ae_12.c = 0;
        ae_12.b = false;
        a3.C = true;
        a3.M = a3.H = a2;
    }
}

