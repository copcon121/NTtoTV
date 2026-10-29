/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.sf_0;
import ttw.tradefinder.yf_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.eE
 */
public class ee_0 {
    public static int h = Integer.MAX_VALUE;
    private int H;
    private long D;
    private long A;
    private int C;
    private yf_0 M;
    private yf_0 b;
    private final ze_2 c;

    public void E(boolean a2, int a3, long a4) {
        ee_0 a5;
        if (a4 <= 0L) {
            ee_0 ee_02 = a5;
            long l2 = ee_02.D = a2 ? ee_02.M.E(a3, 0L) : ee_02.b.E(a3, 0L);
            if (a5.D > 0L) {
                if (!a2 && a3 == a5.H) {
                    ee_0 ee_03 = a5;
                    a5.H = a5.b.int_E(ee_03.H);
                    if (ee_03.H == 0) {
                        a5.H = h;
                        return;
                    }
                } else if (a2 && a3 == a5.C) {
                    a5.C = a5.M.j(a5.C);
                    return;
                }
            }
        } else {
            ee_0 ee_04 = a5;
            long l3 = a5.D = a2 ? ee_04.M.E(a3, a4) : ee_04.b.E(a3, a4);
            if (a5.D <= 0L) {
                if (a2 && a3 > a5.C) {
                    a5.C = a3;
                    return;
                }
                if (!a2 && a3 < a5.H) {
                    a5.H = a3;
                }
            }
        }
    }

    public void void_E() {
        ee_0 a2;
        a2.D = 0L;
        a2.H = h;
        a2.C = 0;
        a2.b.E();
        a2.M.E();
    }

    public ee_0(ze_2 a2) {
        ee_0 a3;
        ee_0 ee_02 = a3;
        ee_0 ee_03 = a3;
        ee_03.A = 0L;
        ee_03.D = 0L;
        ee_02.H = h;
        ee_02.C = 0;
        ee_02.b = new yf_0();
        a3.M = new yf_0();
        a3.c = a2;
        a3.void_E();
    }

    public long long_j() {
        ee_0 a2;
        return a2.D;
    }

    public long long_E() {
        ee_0 a2;
        ee_0 ee_02 = a2;
        ++ee_02.A;
        return ee_02.A;
    }

    public void j(sf_0 a2, int a3, int a4) {
        ee_0 a5;
        if (a5.C == 0) {
            return;
        }
        a5.M.E(a2, a5.C - a4, a5.C - a3);
    }

    public double E(boolean a2, int a3) {
        ee_0 a4;
        ee_0 ee_02 = a4;
        long l2 = a2 ? ee_02.M.long_E(a3) : ee_02.b.long_E(a3);
        if (l2 == 0L) {
            return 0.0;
        }
        return (double)l2 / a4.c.A;
    }

    public long long_E(int a2) {
        ee_0 a3;
        if (a3.H == h || a3.C == 0) {
            return 0L;
        }
        if (a2 >= a3.H) {
            return a3.b.long_E(a2);
        }
        if (a2 <= a3.C) {
            return a3.M.long_E(a2);
        }
        return 0L;
    }

    public int int_j() {
        ee_0 a2;
        return a2.H;
    }

    public double j(int a2, int a3) {
        ee_0 a4;
        if (a4.H == h) {
            return 0.0;
        }
        ee_0 ee_02 = a4;
        double d2 = ee_02.b.double_E(ee_02.H + a2, a4.H + a3);
        if (d2 == 0.0) {
            return 0.0;
        }
        return d2 / a4.c.A;
    }

    public double E(int a2, int a3) {
        ee_0 a4;
        if (a4.C == 0) {
            return 0.0;
        }
        ee_0 ee_02 = a4;
        double d2 = ee_02.M.double_E(ee_02.C - a3, a4.C - a2);
        if (d2 == 0.0) {
            return 0.0;
        }
        return d2 / a4.c.A;
    }

    public double double_E(int a2) {
        ee_0 a3;
        return (double)a2 / a3.c.A;
    }

    public int int_E() {
        ee_0 a2;
        if (a2.C == 0) {
            return h;
        }
        return a2.H;
    }

    public void E(sf_0 a2, int a3, int a4) {
        ee_0 a5;
        if (a5.H == h) {
            return;
        }
        a5.b.E(a2, a5.H + a3, a5.H + a4);
    }
}

