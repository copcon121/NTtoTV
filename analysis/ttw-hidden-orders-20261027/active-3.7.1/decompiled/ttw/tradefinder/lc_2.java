/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.time.DurationFormatUtils
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.time.Duration;
import java.util.Iterator;
import org.apache.commons.lang3.time.DurationFormatUtils;
import ttw.tradefinder.KB;
import ttw.tradefinder.Oe;
import ttw.tradefinder.ge_1;
import ttw.tradefinder.he_1;
import ttw.tradefinder.qa_2;
import ttw.tradefinder.sf_0;
import ttw.tradefinder.td;
import ttw.tradefinder.uc_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.lc
 */
public class lc_2
extends KB {
    private static int h = 4;
    private static int H;
    private int D;
    private static Font A;
    private int C;
    private static int M;
    private td b;
    private static Font c;

    public int j() {
        lc_2 a2;
        return a2.C;
    }

    public lc_2(Oe a2, ze_2 a3, int a2222, int a4, boolean a5, long a6, uc_2 a7, int a82) {
        lc_2 lc_22;
        uc_2 uc_22;
        Font font;
        Font a82;
        float f2;
        lc_2 a9;
        lc_2 lc_23 = a9;
        a9.b = new td();
        lc_23.C = 0;
        lc_23.D = 0;
        Color color = a2.M ? he_1.j : he_1.c;
        float f3 = (float)Math.min(Math.max(a82, 8), 18) / 10.0f;
        if (f2 <= 1.0f) {
            a82 = c.deriveFont(14.0f * f3);
            font = A;
            uc_22 = a7;
        } else if (f3 <= 1.2f) {
            a82 = c;
            font = A.deriveFont(11.0f * f3);
            uc_22 = a7;
        } else if (f3 <= 1.4f) {
            a82 = c.deriveFont(12.0f * f3);
            font = A.deriveFont(11.0f * f3);
            uc_22 = a7;
        } else {
            a82 = c.deriveFont(0, 12.0f * f3);
            font = A.deriveFont(0, 11.0f * f3);
            uc_22 = a7;
        }
        if (uc_22 == uc_2.C) {
            lc_2 lc_24 = a9;
            lc_22 = lc_24;
            lc_24.b.E(new qa_2(a3.E(a2222), a82, color));
        } else if (a7 == uc_2.M) {
            Object a2222 = a3.E(a2222);
            if (a5) {
                a2222 = (String)a2222 + " / " + a3.E(a2.h);
            }
            lc_2 lc_25 = a9;
            lc_22 = lc_25;
            lc_25.b.E(new qa_2((String)a2222, a82, color));
            a9.b.E(new qa_2(a9.E(Duration.ofNanos(a6 - a2.K)), font, color));
        } else {
            int a2222;
            Object a2222 = a3.E(a2222);
            if (a5) {
                a2222 = (String)a2222 + " / " + a3.E(a2.h);
            }
            if (a2.j != 0) {
                a2222 = (String)a2222 + " - " + a3.E(a2.j);
            }
            lc_2 lc_26 = a9;
            lc_26.b.E(new qa_2((String)a2222, a82, color));
            a9.b.E(new qa_2(a9.E(Duration.ofNanos(a6 - a2.K)), font, color));
            lc_26.b.E(new qa_2("at " + a3.j(a4), a82, color));
            lc_22 = a9;
        }
        lc_22.C = lc_22.b.j() + 2 * H;
        a9.D = a9.b.E() + 2 * h + (a9.b.size() - 1) * M;
    }

    public void a(int a2, int a3, Graphics2D a4) {
        lc_2 a5;
        Iterator iterator;
        a3 += h;
        Iterator iterator2 = iterator = a5.b.iterator();
        while (iterator2.hasNext()) {
            qa_2 qa_22 = (qa_2)iterator.next();
            qa_22.E(a2 + H, a3, a4);
            a3 += M + qa_22.E();
            iterator2 = iterator;
        }
    }

    public void j(int a2, int a3, Graphics2D a4) {
        lc_2 a5;
        Iterator iterator;
        a3 += h;
        Iterator iterator2 = iterator = a5.b.iterator();
        while (iterator2.hasNext()) {
            qa_2 qa_22 = (qa_2)iterator.next();
            qa_22.E(a2, a3, a5.C, a4);
            a3 += M + qa_22.E();
            iterator2 = iterator;
        }
    }

    public void E(int a2, int a3, Graphics2D a4) {
        lc_2 a5;
        Iterator iterator;
        a3 += h;
        Iterator iterator2 = iterator = a5.b.iterator();
        while (iterator2.hasNext()) {
            qa_2 qa_22 = (qa_2)iterator.next();
            qa_22.j(a2, a3, a5.C - H, a4);
            a3 += M + qa_22.E();
            iterator2 = iterator;
        }
    }

    public int E() {
        lc_2 a2;
        return a2.D;
    }

    private /* synthetic */ String E(Duration a2) {
        if (a2.toHours() > 0L) {
            return DurationFormatUtils.formatDuration((long)a2.toMillis(), (String)ge_1.E("@[`[(\u0011/\u0011/\\{[{["));
        }
        if (a2.toMinutes() > 0L) {
            return DurationFormatUtils.formatDuration((long)a2.toMillis(), (String)sf_0.E("\tQ\tQD\u0005C\u0005C"));
        }
        return DurationFormatUtils.formatDuration((long)a2.toMillis(), (String)ge_1.E("{[{["));
    }

    static {
        M = 3;
        H = 7;
        c = new Font(sf_0.E("%\u0004\r\u0017\b"), 1, 14);
        A = new Font(ge_1.E("=z\u0015i\u0010"), 1, 11);
    }
}

