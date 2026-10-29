/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.text.DecimalFormat;
import ttw.tradefinder.nd_2;

/*
 * Renamed from ttw.tradefinder.UD
 */
public class ud_0 {
    public boolean M;
    public int b;
    public int c;

    public /* synthetic */ String toString() {
        ud_0 a2;
        DecimalFormat decimalFormat = new DecimalFormat(nd_2.E("\u001a\t"));
        return decimalFormat.format(a2.b) + ":" + decimalFormat.format(a2.c);
    }

    public /* synthetic */ ud_0() {
        ud_0 a2;
        ud_0 ud_02 = a2;
        ud_0 ud_03 = a2;
        ud_0 ud_04 = a2;
        ud_04.M = false;
        ud_04.b = 0;
        ud_03.c = 0;
        ud_03.M = false;
        ud_02.b = 0;
        ud_02.c = 0;
    }

    public /* synthetic */ int E(ud_0 a2) {
        ud_0 a3;
        if (a3.b > a2.b) {
            return 1;
        }
        if (a3.b < a2.b) {
            return -1;
        }
        if (a3.c > a2.c) {
            return 1;
        }
        if (a3.c < a2.c) {
            return -1;
        }
        return 0;
    }

    public static /* synthetic */ ud_0 E() {
        return new ud_0();
    }

    public /* synthetic */ ud_0(int a2, int a3) {
        ud_0 a4;
        ud_0 ud_02 = a4;
        ud_0 ud_03 = a4;
        ud_0 ud_04 = a4;
        ud_04.M = false;
        ud_04.b = 0;
        ud_03.c = 0;
        ud_03.M = true;
        ud_02.b = a2;
        ud_02.c = a3;
    }
}

