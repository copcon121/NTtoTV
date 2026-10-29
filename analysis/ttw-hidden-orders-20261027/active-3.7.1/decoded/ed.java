/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Graphics2D;
import ttw.tradefinder.h_0;
import ttw.tradefinder.he_1;

public class ed
implements h_0 {
    private double A;
    private int C;
    private Color M;
    private Color b;
    private int c;

    public void E(double a2) {
        a.A = a2;
    }

    @Override
    public void E(int a2) {
        ed a3;
        a3.M = he_1.E(a3.M, a2);
    }

    public void E(Color a2) {
        a.M = a2;
    }

    @Override
    public void j(int a2, int a3, int a4, int a5, Graphics2D a62) {
        ed a7;
        Graphics2D graphics2D = a62;
        a62.setColor(a7.M);
        graphics2D.fillRect(a2, a3, a4, a5);
        int a62 = (int)((double)(a4 - 2 * a7.c) * a7.A);
        graphics2D.setColor(a7.b);
        graphics2D.fillRect(a2 + a7.c + (a4 - a62) / 2, a3 + a7.C, a62, a5 - 2 * a7.C);
    }

    public ed(Color a2, int a3, int a4) {
        ed a5;
        ed ed2 = a5;
        ed ed3 = a5;
        ed ed4 = a5;
        a5.M = he_1.D;
        a5.b = he_1.a;
        ed4.A = 0.0;
        ed4.c = 0;
        ed3.C = 0;
        ed3.b = a2;
        ed2.c = a3;
        ed2.C = a4;
    }

    @Override
    public void a(int a2, int a3, int a4, int a5, Graphics2D a62) {
        ed a7;
        Graphics2D graphics2D = a62;
        a62.setColor(a7.M);
        graphics2D.fillRect(a2, a3, a4, a5);
        int a62 = (int)((double)(a4 - 2 * a7.c) * a7.A);
        graphics2D.setColor(a7.b);
        graphics2D.fillRect(a2 + a7.c + (a4 - a62), a3 + a7.C, a62, a5 - 2 * a7.C);
    }

    @Override
    public void E(int a2, int a3, int a4, int a5, Graphics2D a6) {
        ed a7;
        Graphics2D graphics2D = a6;
        a6.setColor(a7.M);
        graphics2D.fillRect(a2, a3, a4, a5);
        a4 = (int)((double)(a4 - 2 * a7.c) * a7.A);
        graphics2D.setColor(a7.b);
        graphics2D.fillRect(a2 + a7.c, a3 + a7.C, a4, a5 - 2 * a7.C);
    }
}

