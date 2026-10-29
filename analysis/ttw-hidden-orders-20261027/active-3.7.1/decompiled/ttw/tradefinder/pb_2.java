/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.PB
 */
public class pb_2 {
    public double A;
    public double C;
    public double M;
    public double b;
    public long c;

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 4 << 3 ^ 2;
        int cfr_ignored_0 = 5 << 4 ^ 3 << 1;
        int n5 = n3;
        int n6 = (3 ^ 5) << 4 ^ 4 << 1;
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

    public pb_2() {
        pb_2 a2;
        pb_2 pb_22 = a2;
        pb_2 pb_23 = a2;
        a2.A = Double.NaN;
        pb_23.C = Double.NaN;
        pb_23.M = Double.NaN;
        pb_22.b = Double.NaN;
        pb_22.c = 0L;
    }

    public pb_2(double a2, double a3, double a4, double a5, long a6) {
        pb_2 a7;
        pb_2 pb_22 = a7;
        pb_2 pb_23 = a7;
        pb_2 pb_24 = a7;
        pb_2 pb_25 = a7;
        pb_2 pb_26 = a7;
        pb_26.A = Double.NaN;
        pb_26.C = Double.NaN;
        pb_25.M = Double.NaN;
        pb_25.b = Double.NaN;
        pb_24.c = 0L;
        pb_24.A = a2;
        pb_23.C = a3;
        pb_23.M = a4;
        pb_22.b = a5;
        pb_22.c = a6;
    }

    public void E(pb_2 a2) {
        pb_2 pb_22;
        pb_2 pb_23;
        pb_2 pb_24;
        pb_2 a3;
        if (Double.isNaN(a3.A)) {
            pb_24 = a3;
            a3.A = a2.A;
        } else {
            if (!Double.isNaN(a2.A)) {
                a3.A = (a3.A + a2.A) / 2.0;
            }
            pb_24 = a3;
        }
        if (Double.isNaN(pb_24.C)) {
            pb_23 = a3;
            a3.C = a2.C;
        } else {
            if (!Double.isNaN(a2.C)) {
                a3.C = (a3.C + a2.C) / 2.0;
            }
            pb_23 = a3;
        }
        if (Double.isNaN(pb_23.M)) {
            pb_22 = a3;
            a3.M = a2.M;
        } else {
            if (!Double.isNaN(a2.M)) {
                a3.M = (a3.M + a2.M) / 2.0;
            }
            pb_22 = a3;
        }
        if (Double.isNaN(pb_22.b)) {
            a3.b = a2.b;
            return;
        }
        if (!Double.isNaN(a2.b)) {
            a3.b = (a3.b + a2.b) / 2.0;
        }
    }
}

