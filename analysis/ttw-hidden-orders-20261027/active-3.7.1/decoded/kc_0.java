/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Graphics2D;
import ttw.tradefinder.h_0;
import ttw.tradefinder.he_1;

/*
 * Renamed from ttw.tradefinder.Kc
 */
public class kc_0
implements h_0 {
    private Color c;

    @Override
    public void E(int a2, int a3, int a4, int a5, Graphics2D a6) {
        kc_0 a7;
        a7.j(a2, a3, a4, a5, a6);
    }

    @Override
    public void a(int a2, int a3, int a4, int a5, Graphics2D a6) {
        kc_0 a7;
        a7.j(a2, a3, a4, a5, a6);
    }

    @Override
    public void E(int a2) {
        kc_0 a3;
        a3.c = he_1.E(a3.c, a2);
    }

    @Override
    public void j(int a2, int a3, int a4, int a5, Graphics2D a6) {
        kc_0 a7;
        Graphics2D graphics2D = a6;
        graphics2D.setColor(a7.c);
        graphics2D.fillRect(a2, a3, a4, a5);
    }

    public kc_0(Color a2) {
        kc_0 a3;
        a3.c = a2;
    }
}

