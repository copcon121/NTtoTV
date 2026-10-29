/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.sf_0;

/*
 * Renamed from ttw.tradefinder.yf
 */
public class yf_0 {
    private int C;
    private final Object M;
    private long[] b;
    private int c;

    public long long_E(int a2) {
        yf_0 a3;
        Object object = a3.M;
        synchronized (object) {
            if (a3.b == null || a2 < a3.c || a2 > a3.C) {
                return 0L;
            }
            return a3.b[a2 - a3.c];
        }
    }

    public yf_0() {
        yf_0 a2;
        yf_0 yf_02 = a2;
        a2.M = new Object();
        a2.b = null;
        yf_02.c = -1;
        yf_02.C = -1;
    }

    public int j(int a2) {
        yf_0 a3;
        Object object = a3.M;
        synchronized (object) {
            if (a3.b == null) {
                return 0;
            }
            int n2 = a2 = Math.max(0, Math.min(a2 - a3.c, a3.b.length - 1));
            while (n2 >= 0) {
                if (a3.b[a2] != 0L) {
                    return a2 + a3.c;
                }
                n2 = --a2;
            }
            return 0;
        }
    }

    public void E(sf_0 a2, int a3, int a4) {
        yf_0 a5;
        Object object = a5.M;
        synchronized (object) {
            if (a5.b == null) {
                return;
            }
            if (a3 > a5.C || a4 < a5.c) {
                return;
            }
            yf_0 yf_02 = a5;
            a3 = Math.min(Math.max(yf_02.c, a3), a5.C) - a5.c;
            a4 = Math.min(Math.max(yf_02.c, a4), a5.C) - a5.c;
            int n2 = a3 = a3;
            while (n2 <= a4) {
                a2.E(a5.b[a3++]);
                n2 = a3;
            }
            return;
        }
    }

    public void E() {
        yf_0 a2;
        Object object = a2.M;
        synchronized (object) {
            yf_0 yf_02 = a2;
            yf_02.b = null;
            yf_02.c = -1;
            a2.C = -1;
            return;
        }
    }

    private /* synthetic */ void void_E(int a2, int a3) {
        long[] lArray = new long[a2];
        int n2 = 0;
        int n3 = 0;
        int n4 = n2;
        while (n4 < a2) {
            yf_0 a4;
            if (n2 >= a3 && n3 < a4.b.length) {
                long l2 = a4.b[n3];
                ++n3;
                lArray[n2] = l2;
            } else {
                lArray[n2] = 0L;
            }
            n4 = ++n2;
        }
        a4.b = lArray;
    }

    public long E(int a2, long a3) {
        yf_0 a4;
        Object object = a4.M;
        synchronized (object) {
            if (a4.b == null) {
                yf_0 yf_02 = a4;
                a4.b = new long[1];
                yf_02.c = a2;
                yf_02.C = a2;
            }
            if (a2 > a4.C) {
                yf_0 yf_03 = a4;
                int n2 = a2;
                yf_03.C = n2 + Math.min(1000, Integer.MAX_VALUE - n2 - 1);
                yf_03.void_E(yf_03.C - a4.c + 1, 0);
            }
            if (a2 < a4.c) {
                yf_0 yf_04 = a4;
                yf_04.c = Math.max(a2 - 1000, 0);
                yf_0 yf_05 = a4;
                yf_04.void_E(yf_04.C - a4.c + 1, yf_05.C - yf_05.c + 1 - a4.b.length);
            }
            if (a2 - a4.c <= 0 || a2 - a4.c > a4.b.length) {
                return 0L;
            }
            yf_0 yf_06 = a4;
            long l2 = yf_06.b[a2 - a4.c];
            yf_06.b[a2 - a4.c] = a3;
            return l2;
        }
    }

    public double double_E(int a2, int a3) {
        yf_0 a4;
        Object object = a4.M;
        synchronized (object) {
            if (a4.b == null) {
                return 0.0;
            }
            if (a2 > a4.C || a3 < a4.c) {
                return 0.0;
            }
            long l2 = 0L;
            int n2 = 0;
            yf_0 yf_02 = a4;
            a2 = Math.min(Math.max(a4.c, a2), a4.C) - yf_02.c;
            a3 = Math.min(Math.max(yf_02.c, a3), a4.C) - a4.c;
            int n3 = a2 = a2;
            while (n3 <= a3) {
                ++n2;
                l2 += a4.b[a2];
                n3 = ++a2;
            }
            if (n2 == 0) {
                return 0.0;
            }
            return (double)l2 / (double)n2;
        }
    }

    public int int_E(int a2) {
        yf_0 a3;
        Object object = a3.M;
        synchronized (object) {
            if (a3.b == null) {
                return 0;
            }
            int n2 = a2 = Math.max(0, Math.min(a2 - a3.c, a3.b.length - 1));
            while (n2 < a3.b.length) {
                if (a3.b[a2] != 0L) {
                    return a2 + a3.c;
                }
                n2 = ++a2;
            }
            return 0;
        }
    }
}

