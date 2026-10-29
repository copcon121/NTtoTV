/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.simplified.Intervals
 */
package ttw.tradefinder;

import ttw.tradefinder.y_0;
import velox.api.layer1.simplified.Intervals;

/*
 * Renamed from ttw.tradefinder.CD
 */
public class cd_2 {
    public static long a;
    public static long h;
    public static long H;
    private int D;
    private y_0 A;
    public static long C;
    public static long M;
    private long b;
    private long c;

    public void E(long a2) {
        cd_2 a3;
        if (a3.b == 0L) {
            a3.b = a2;
        }
        if (a2 < a3.b) {
            return;
        }
        a3.b = a2 + a3.c;
        if (a3.D != -1) {
            a3.A.E(a2, a3.D);
            return;
        }
        a3.A.H(a2);
    }

    public void E() {
        a.b = 0L;
    }

    public cd_2(long a2, y_0 a3) {
        a4(a2, a3, -1);
        cd_2 a4;
    }

    static {
        M = Intervals.INTERVAL_100_MILLISECONDS;
        h = Intervals.INTERVAL_100_MILLISECONDS + Intervals.INTERVAL_200_MILLISECONDS;
        a = Intervals.INTERVAL_500_MILLISECONDS;
        C = Intervals.INTERVAL_2_SECONDS;
        H = Intervals.INTERVAL_5_SECONDS;
    }

    public cd_2(long a2, y_0 a3, int a4) {
        cd_2 a5;
        cd_2 cd_22 = a5;
        cd_2 cd_23 = a5;
        cd_2 cd_24 = a5;
        cd_24.D = -1;
        cd_24.b = 0L;
        cd_23.c = 0L;
        cd_23.c = a2;
        cd_22.A = a3;
        cd_22.D = a4;
    }
}

