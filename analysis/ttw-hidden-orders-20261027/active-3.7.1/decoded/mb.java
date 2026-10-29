/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Graphics2D;
import ttw.tradefinder.ha_1;
import ttw.tradefinder.m_0;
import ttw.tradefinder.oa_1;

/*
 * Duplicate member names - consider using --renamedupmembers true
 */
public class mb
implements m_0 {
    private final m_0 b;
    private final m_0 c;

    @Override
    public int j() {
        mb a2;
        return a2.c.a();
    }

    @Override
    public void E(Color a2, int a3) {
        mb a4;
        mb mb2 = a4;
        mb2.c.E(a2, a3);
        mb2.b.E(a3);
    }

    public mb(String a2, oa_1 a3) {
        mb a4;
        a4.c = new ha_1(a2);
        a4.b = a3;
    }

    @Override
    public void E(int a2) {
        mb a3;
        a3.c.E(a2);
    }

    @Override
    public void E(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        mb a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public int a() {
        mb a2;
        return a2.c.a() + a2.b.a();
    }

    public mb(String a2, String a3) {
        a4(a2, new oa_1(a3));
        mb a4;
    }

    @Override
    public void E(double a2) {
        mb a3;
        mb mb2 = a3;
        mb2.c.E(a2);
        mb2.b.E(a2);
    }

    @Override
    public void f(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        mb a8;
        if (a6 == 0) {
            mb mb2 = a8;
            mb2.c.f(a2 + (a4 - a8.a()), a3, a8.c.a(), a5, 0, a7);
            mb2.b.f(a2 + (a4 - a8.b.a()), a3, a8.b.a(), a5, 0, a7);
            return;
        }
        mb mb3 = a8;
        mb3.c.f(a2 + (a6 - a8.c.a()), a3, a8.c.a(), a5, 0, a7);
        mb3.b.f(a2 + (a4 - a8.b.a()), a3, a8.b.a(), a5, 0, a7);
    }

    @Override
    public void j(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        mb a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public void A(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        mb a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public void l(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        mb a8;
        if (a6 == 0) {
            mb mb2 = a8;
            mb2.c.l(a2, a3, a8.c.a(), a5, 0, a7);
            mb2.b.l(a2 + a8.c.a(), a3, a8.b.a(), a5, 0, a7);
            return;
        }
        mb mb3 = a8;
        mb3.c.l(a2, a3, a8.c.a(), a5, 0, a7);
        mb3.b.d(a2 + a6, a3, a8.b.a(), a5, 0, a7);
    }

    @Override
    public void a(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        mb a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public int E(int a2) {
        mb a3;
        return a3.c.E(a2 / 2) + a3.b.E(a2 / 2);
    }

    @Override
    public int j(int a2) {
        mb a3;
        return Math.max(a3.c.j(a2), a3.b.j(a2));
    }

    @Override
    public void H(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        mb a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public void d(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        mb a8;
        if (a6 == 0) {
            int n2 = a2 = (a4 - a8.a()) / 2;
            a8.c.f(n2, a3, a8.c.a(), a5, 0, a7);
            mb mb2 = a8;
            a2 = n2 + mb2.c.a();
            mb2.b.l(a2, a3, a8.b.a(), a5, 0, a7);
            return;
        }
        mb mb3 = a8;
        mb3.c.f(a2, a3, a6, a5, 0, a7);
        mb3.b.l(a2 + a6, a3, a4 - a6, a5, 0, a7);
    }

    @Override
    public void g(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        mb a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public int E() {
        mb a2;
        return Math.max(a2.c.E(), a2.b.E());
    }
}

