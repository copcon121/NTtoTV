/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Triple
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import org.apache.commons.lang3.tuple.Triple;
import ttw.tradefinder.KB;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.he_1;

/*
 * Renamed from ttw.tradefinder.zC
 */
public class zc_1
extends KB {
    private static Font h;
    private String H;
    private Triple<Integer, Integer, Integer> D;
    private int A;
    private Color C;
    private int M;
    private static int b;
    private static int c;

    public int j() {
        zc_1 a2;
        return a2.A;
    }

    static {
        b = 2;
        c = 4;
        h = new Font(cc_0.E("\u0015P=C8"), 0, 12);
    }

    public zc_1(String a2) {
        zc_1 a3;
        zc_1 zc_12 = a3;
        zc_12.H = a2;
        a3.C = he_1.C;
        zc_12.D = zc_12.E(h, a3.H);
        zc_12.A = (Integer)zc_12.D.getLeft() + 2 * c;
        a3.M = (Integer)a3.D.getMiddle() + 2 * b;
    }

    public int E() {
        zc_1 a2;
        return a2.M;
    }

    public void E(int a2, int a3, Graphics2D a4) {
        zc_1 a5;
        Graphics2D graphics2D = a4;
        a4.setFont(h);
        graphics2D.setColor(a5.C);
        graphics2D.drawString(a5.H, a2 + c, a3 + b + (Integer)a5.D.getRight());
    }
}

