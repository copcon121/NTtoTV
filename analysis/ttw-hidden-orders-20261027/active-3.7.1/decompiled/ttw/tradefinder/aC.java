/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Graphics2D;
import ttw.tradefinder.e_0;
import ttw.tradefinder.m_0;

public class aC
implements e_0 {
    private final m_0 b;
    private final m_0 c;

    @Override
    public int E(int a2) {
        aC a3;
        return a3.b.E(0) + a3.c.E(0) + 2 * a2;
    }

    @Override
    public void d(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        aC a8;
        aC aC2 = a8;
        aC2.b.l(a2, a3, a6, a5, 0, a7);
        aC2.c.l(a2 + a6, a3, a4 - a6, a5, 0, a7);
    }

    @Override
    public int j() {
        aC a2;
        return a2.b.a();
    }

    @Override
    public int d() {
        aC a2;
        return a2.c.a();
    }

    @Override
    public void A(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        aC a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    public aC(m_0 a2, m_0 a3) {
        aC a4;
        aC aC2 = a4;
        aC2.b = a2;
        aC2.c = a3;
    }

    @Override
    public void H(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        aC a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public int j(int a2) {
        aC a3;
        return Math.max(a3.b.j(a2), a3.c.j(a2));
    }

    @Override
    public int a() {
        aC a2;
        return a2.b.a() + a2.c.a();
    }

    @Override
    public int E() {
        aC a2;
        return Math.max(a2.b.E(), a2.c.E());
    }

    @Override
    public void C(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        aC a8;
        aC aC2 = a8;
        aC2.b.f(a2 + a4 - a6, a3, a6, a5, 0, a7);
        aC2.c.f(a2, a3, a4 - a6, a5, 0, a7);
    }

    public void E(int a2, int a3, int a4, int a5, Graphics2D a6) {
        aC a7;
        aC aC2 = a7;
        aC2.b.l(a2, a3, a7.b.a(), a5, 0, a6);
        aC2.c.l(a2 + a7.b.a(), a3, a4 - a7.b.a(), 0, a5, a6);
    }

    @Override
    public void j(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        aC a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public void g(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        aC a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public void E(double a2) {
        aC a3;
        aC aC2 = a3;
        aC2.b.E(a2);
        aC2.c.E(a2);
    }
}

