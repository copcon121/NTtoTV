/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.List;
import ttw.tradefinder.xd_0;

/*
 * Renamed from ttw.tradefinder.Wd
 */
public class wd_1 {
    private final int K;
    private final boolean E;
    private List<Double> j;
    public double a;
    public double h;
    private int H;
    private final int D;
    private xd_0 A;
    private double C;
    private final int M;
    private double b;
    private int c;

    /*
     * Unable to fully structure code
     */
    public /* synthetic */ void E(double a, long a) {
        var5_4 = a - a.b;
        v0 = a;
        v0.b = a;
        v0.C += var5_4;
        v0.j.add(var5_4);
        if (v0.j.size() > a.K) {
            a.C -= a.j.remove(0).doubleValue();
        }
        if (!(a.E == false || a.C > 0.0 && a > 0.0) && (!(a.C < 0.0) || !(a < 0.0)) || !(a.C > 0.0 && Math.abs(a.C) > a.h) && (!(a.C < 0.0) || !(Math.abs(a.C) > a.a))) ** GOTO lbl22
        v1 = a = a.C > 0.0 ? xd_0.b : xd_0.c;
        if (a.A == a) ** GOTO lbl22
        if (a.A == xd_0.A) {
            v2 = a;
            a.c = a.D;
            a.H = 0;
            a.A = a;
        } else {
            if (a.A != xd_0.M) {
                a.c = a.D << 1;
                a.H = 0;
                a.A = xd_0.M;
            }
lbl22:
            // 5 sources

            v2 = a;
        }
        if (v2.c <= 0) ** GOTO lbl33
        v3 = a;
        --v3.c;
        if (v3.c != 0) ** GOTO lbl33
        if (a.A != xd_0.M) {
            v4 = a;
            v5 = v4;
            v4.H = v4.M;
        } else {
            a.A = xd_0.A;
lbl33:
            // 3 sources

            v5 = a;
        }
        if (v5.H > 0) {
            v6 = a;
            --v6.H;
            if (v6.H == 0) {
                a.A = xd_0.A;
            }
        }
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (3 ^ 5) << 3 ^ 4;
        int cfr_ignored_0 = 5 << 4 ^ (3 << 2 ^ 3);
        int n5 = n3;
        int n6 = 4 << 4 ^ (2 << 2 ^ 1);
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

    public /* synthetic */ xd_0 ttw_tradefinder_xd_0_E() {
        wd_1 a2;
        return a2.A;
    }

    public /* synthetic */ double double_E() {
        wd_1 a2;
        return a2.C;
    }

    public /* synthetic */ wd_1(int a2, int a3, int a4, double a5, boolean a6) {
        wd_1 a7;
        wd_1 wd_12 = a7;
        wd_1 wd_13 = a7;
        wd_1 wd_14 = a7;
        wd_1 wd_15 = a7;
        wd_1 wd_16 = a7;
        wd_1 wd_17 = a7;
        wd_17.j = new ArrayList<Double>();
        wd_17.C = 0.0;
        wd_16.b = 0.0;
        wd_16.H = 0;
        wd_16.A = xd_0.A;
        wd_15.h = 0.0;
        wd_15.a = 0.0;
        wd_14.c = 0;
        wd_14.K = a2;
        wd_13.M = a4;
        wd_13.D = a3;
        wd_12.a = a7.h = a5;
        wd_12.E = a6;
    }

    public /* synthetic */ boolean boolean_E() {
        wd_1 a2;
        return a2.H > 0;
    }
}

