/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Graphics2D;
import ttw.tradefinder.m_0;

/*
 * Renamed from ttw.tradefinder.E
 */
public interface e_0
extends m_0 {
    @Override
    default public void E(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        e_0 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public int j();

    @Override
    default public void E(int a2) {
    }

    @Override
    default public void l(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        e_0 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    default public void E(Color a2, int a3) {
    }

    public int d();

    @Override
    default public void f(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        e_0 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public void d(int var1, int var2, int var3, int var4, int var5, Graphics2D var6);

    @Override
    default public void a(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        e_0 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    public void C(int var1, int var2, int var3, int var4, int var5, Graphics2D var6);
}

