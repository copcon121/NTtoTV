/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Graphics2D;
import ttw.tradefinder.fd;
import ttw.tradefinder.he_1;
import ttw.tradefinder.id_0;
import ttw.tradefinder.m_0;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.Ld
 */
public class ld_0
implements m_0 {
    private static final int M = 5;
    private final id_0 b;
    private final fd c;

    @Override
    public void a(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        ld_0 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public int j() {
        return 0;
    }

    @Override
    public int E(int a2) {
        ld_0 a3;
        return Math.max(a3.c.E(a2), a3.b.E(a2));
    }

    @Override
    public void E(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        ld_0 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public int j(int a2) {
        ld_0 a3;
        return a3.c.j(0) + a3.b.j(0) + 2 * a2;
    }

    @Override
    public int E() {
        ld_0 a2;
        return a2.c.E() + a2.b.E() + 10;
    }

    public ld_0(String a2, String a3) {
        ld_0 a4;
        ld_0 ld_02 = a4;
        ld_02.c = new fd(a2);
        ld_02.b = new id_0(a3, 1);
        ld_02.b.E(he_1.H, 255);
    }

    @Override
    public void E(int a2) {
        ld_0 a3;
        ld_0 ld_02 = a3;
        ld_02.c.E(a2);
        ld_02.b.E(a2);
    }

    @Override
    public void l(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        ld_0 a8;
        a5 = (a5 - a8.c.E() - a8.b.E()) / 2;
        ld_0 ld_02 = a8;
        ld_02.c.j(a2, a3, a4, a8.c.E() + a5, 0, a7);
        ld_02.b.A(a2, a3 + a8.c.E() + a5, a4, a8.b.E() + a5, 0, a7);
    }

    @Override
    public void H(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        ld_0 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public void f(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        ld_0 a8;
        a5 = (a5 - a8.c.E() - a8.b.E()) / 2;
        ld_0 ld_02 = a8;
        ld_02.c.g(a2, a3, a4, a8.c.E() + a5, 0, a7);
        ld_02.b.H(a2, a3 + a8.c.E() + a5, a4, a8.b.E() + a5, 0, a7);
    }

    @Override
    public void g(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        ld_0 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public void A(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        ld_0 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public int a() {
        ld_0 a2;
        return Math.max(a2.c.a(), a2.b.a());
    }

    @Override
    public void E(Color a2, int a3) {
        ld_0 a4;
        ld_0 ld_02 = a4;
        ld_02.c.E(a2, a3);
        ld_02.b.E(a2, a3);
    }

    @Override
    public void d(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        ld_0 a8;
        a5 = (a5 - a8.c.E() - a8.b.E()) / 2;
        ld_0 ld_02 = a8;
        ld_02.c.E(a2, a3, a4, a8.c.E() + a5, 0, a7);
        ld_02.b.a(a2, a3 + a8.c.E() + a5, a4, a8.b.E() + a5, 0, a7);
    }

    @Override
    public void j(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        ld_0 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public void E(double a2) {
        ld_0 a3;
        ld_0 ld_02 = a3;
        ld_02.c.E(a2);
        ld_02.b.E(a2);
    }
}

