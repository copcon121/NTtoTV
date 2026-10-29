/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.Wa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ef_1;
import ttw.tradefinder.iy;
import ttw.tradefinder.od_1;
import ttw.tradefinder.wd_2;

/*
 * Renamed from ttw.tradefinder.RE
 */
public class re_1 {
    private double d;
    private od_1 i;
    private long e;
    private boolean k;
    private long B;
    private boolean K;
    private int E;
    private long j;
    private double a;
    private double h;
    private int H;
    private int D;
    private ef_1 A;
    private final df_0<Wa, iy> C;
    private double M;
    private long b;
    private boolean c;

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 3 << 3 ^ 3;
        int cfr_ignored_0 = 5 << 3;
        int n5 = n3;
        int n6 = (3 ^ 5) << 3 ^ 1;
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

    /*
     * Enabled aggressive block sorting
     */
    public /* synthetic */ wd_2 E(long a2, double a3, int a4) {
        re_1 a5;
        wd_2 wd_22 = null;
        double d2 = Math.abs(a3);
        if (a5.K && a3 > 0.0 || !a5.K && a3 <= 0.0) {
            a5.K = !a5.K;
            re_1 re_12 = a5;
            a5.M = a5.K ? re_12.a : re_12.h;
            re_1 re_13 = a5;
            a5.j();
            a5.B = a2;
            re_13.H = a4;
            od_1 od_12 = re_13.i = a3 > 0.0 ? od_1.b : od_1.c;
        }
        if (d2 > a5.d) {
            a5.d = d2;
            a5.B = a2;
            a5.H = a4;
            if (a5.c) {
                re_1 re_14 = a5;
                re_14.c = false;
                re_14.k = true;
            }
        }
        if (d2 < a5.d * 0.9 && a5.k) {
            boolean bl;
            block14: {
                re_1 re_15;
                a5.k = false;
                bl = false;
                switch (a5.A) {
                    case M: {
                        long l2 = a2 - a5.e;
                        if (l2 > a5.j) break;
                        int n2 = Math.abs(a4 - a5.E);
                        boolean bl2 = a4 > a5.E;
                        boolean bl3 = a5.i == od_1.c && bl2 && n2 >= a5.D || a5.i == od_1.b && !bl2 && n2 >= a5.D;
                        if (bl3) break;
                        bl = true;
                        re_1 re_16 = a5;
                        re_16.A = ef_1.c;
                        re_16.b = a2;
                        break;
                    }
                    case c: {
                        long l3 = a2 - a5.b;
                        if (l3 > a5.j) {
                            re_15 = a5;
                            a5.A = ef_1.M;
                            break block14;
                        } else {
                            bl = true;
                            int n3 = Math.abs(a4 - a5.E);
                            boolean bl4 = a4 > a5.E;
                            n3 = a5.i == od_1.c && bl4 && n3 >= a5.D || a5.i == od_1.b && !bl4 && n3 >= a5.D ? 1 : 0;
                            if (n3 != 0) break;
                            a5.b = a2;
                            break;
                        }
                    }
                    default: {
                        throw new RuntimeException("Unknown MarketVolumeState: " + a5.A.toString());
                    }
                }
                re_15 = a5;
            }
            re_15.e = a2;
            a5.E = a4;
            if (!bl) {
                re_1 re_17;
                boolean bl5;
                if (a3 <= 0.0) {
                    bl5 = true;
                    re_17 = a5;
                } else {
                    bl5 = false;
                    re_17 = a5;
                }
                re_1 re_18 = a5;
                wd_22 = new wd_2(a2, bl5, re_17.M, a5.d, re_18.H, re_18.B);
            }
        }
        if (d2 < Math.max(a5.M * 0.9, a5.d * 0.8)) {
            re_1 re_19 = a5;
            re_1 re_110 = a5;
            re_110.d = Math.max(d2 * 1.2, a5.M);
            re_110.B = a2;
            re_19.H = a4;
            re_19.c = true;
        }
        return wd_22;
    }

    public /* synthetic */ void j() {
        re_1 a2;
        re_1 re_12 = a2;
        re_1 re_13 = a2;
        re_13.k = false;
        re_13.c = true;
        a2.d = a2.M;
        a2.B = 0L;
        re_12.A = ef_1.M;
        re_12.e = 0L;
    }

    public /* synthetic */ void E() {
        re_1 a2;
        if (a2.h == ((Wa)a2.C.M).h && a2.a == ((Wa)a2.C.M).C) {
            return;
        }
        a2.h = ((Wa)a2.C.M).h;
        a2.a = ((Wa)a2.C.M).C;
        re_1 re_12 = a2;
        double d2 = a2.M = a2.K ? re_12.a : re_12.h;
        if (a2.M < a2.d * 0.8) {
            a2.c = true;
        }
        a2.d = Math.max(a2.d, a2.M);
        a2.k = false;
        a2.j = (long)(((Wa)a2.C.M).A * 60) * 1000000000L;
        a2.D = ((Wa)a2.C.M).D;
    }

    public /* synthetic */ re_1(df_0<Wa, iy> a2) {
        re_1 a3;
        re_1 re_12 = a3;
        re_1 re_13 = a3;
        re_1 re_14 = a3;
        re_1 re_15 = a3;
        re_1 re_16 = a3;
        re_1 re_17 = a3;
        re_1 re_18 = a3;
        a3.h = 0.0;
        re_18.a = 0.0;
        re_18.M = 0.0;
        re_17.K = false;
        re_17.d = 0.0;
        re_16.B = 0L;
        re_16.H = 0;
        re_15.k = 0;
        re_15.c = true;
        re_14.A = ef_1.M;
        re_14.b = 0L;
        re_13.e = 0L;
        re_13.E = 0;
        re_12.i = od_1.b;
        re_12.j = 0L;
        a3.D = 0;
        a3.C = a2;
        a3.h = ((Wa)a3.C.M).h;
        a3.a = ((Wa)a3.C.M).C;
        a3.K = false;
        re_1 re_19 = a3;
        a3.M = a3.K ? re_19.a : re_19.h;
        re_1 re_110 = a3;
        re_110.d = re_110.M;
        re_110.j = (long)(((Wa)re_110.C.M).A * 60) * 1000000000L;
        a3.D = ((Wa)a3.C.M).D;
    }
}

