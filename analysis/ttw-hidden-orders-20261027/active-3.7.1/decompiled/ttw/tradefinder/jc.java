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
import ttw.tradefinder.he_1;
import ttw.tradefinder.m_0;

/*
 * Duplicate member names - consider using --renamedupmembers true
 */
public abstract class jc
extends KB
implements m_0 {
    private final int K;
    private String E;
    private Font j;
    private final int a;
    private int h;
    private Triple<Integer, Integer, Integer> H;
    private Color D;
    private final int A;
    private final int C;
    private final int M;
    private int b;
    private final int c;

    @Override
    public int E() {
        jc a2;
        return a2.b;
    }

    @Override
    public void d(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        jc a8;
        Graphics2D graphics2D = a7;
        jc jc2 = a8;
        a7.setFont(jc2.j);
        graphics2D.setColor(jc2.D);
        graphics2D.drawString(a8.E, a2 + (a4 - (Integer)a8.H.getLeft()) / 2, a3 + (a5 - (Integer)a8.H.getMiddle()) / 2 + (Integer)a8.H.getRight());
    }

    public jc(String a2, int a3, int a4, int a5, int a6, Font a7, Color a8) {
        jc a9;
        int n2 = a3;
        int n3 = a4;
        a9(a2, n2, n2, n3, n3, a5, a6, a7, a8);
    }

    @Override
    public void E(Color a2, int a3) {
        a.D = a2;
    }

    @Override
    public void l(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        jc a8;
        Graphics2D graphics2D = a7;
        jc jc2 = a8;
        a7.setFont(jc2.j);
        graphics2D.setColor(jc2.D);
        graphics2D.drawString(a8.E, a2 + a8.a, a3 + (a5 - (Integer)a8.H.getMiddle()) / 2 + (Integer)a8.H.getRight());
    }

    public jc(String a2, int a3, int a4, int a5, int a6, int a7, Font a8, Color a9) {
        jc a10;
        int n2 = a5;
        a10(a2, a3, a4, n2, n2, a6, a7, a8, a9);
    }

    @Override
    public void f(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        jc a8;
        Graphics2D graphics2D = a7;
        jc jc2 = a8;
        a7.setFont(jc2.j);
        graphics2D.setColor(jc2.D);
        graphics2D.drawString(a8.E, a2 + (a4 - (Integer)a8.H.getLeft() - a8.M), a3 + (a5 - (Integer)a8.H.getMiddle()) / 2 + (Integer)a8.H.getRight());
    }

    @Override
    public void a(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        jc a8;
        Graphics2D graphics2D = a7;
        jc jc2 = a8;
        a7.setFont(jc2.j);
        graphics2D.setColor(jc2.D);
        graphics2D.drawString(a8.E, a2 + (a4 - (Integer)a8.H.getLeft()) / 2, a3 + a8.A + (Integer)a8.H.getRight());
    }

    @Override
    public int j() {
        return 0;
    }

    public /* synthetic */ void E(String a2) {
        jc a3;
        a3.E = a2;
        jc jc2 = a3;
        a3.H = a3.E(jc2.j, a3.E);
        jc2.b = Math.max((Integer)jc2.H.getMiddle() + a3.A + a3.K, a3.c);
        a3.h = Math.max((Integer)a3.H.getLeft() + a3.M + a3.a, a3.C);
    }

    @Override
    public int E(int a2) {
        jc a3;
        return (Integer)a3.H.getLeft() + 2 * a2;
    }

    @Override
    public void j(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        jc a8;
        Graphics2D graphics2D = a7;
        jc jc2 = a8;
        a7.setFont(jc2.j);
        graphics2D.setColor(jc2.D);
        graphics2D.drawString(a8.E, a2 + a8.a, a3 + (a5 - (Integer)a8.H.getMiddle() - a8.K) + (Integer)a8.H.getRight());
    }

    @Override
    public int j(int a2) {
        jc a3;
        return (Integer)a3.H.getMiddle() + 2 * a2;
    }

    public jc(String a2, int a3, int a4, int a5, int a6, int a7, int a8, Font a9, Color a10) {
        jc a11;
        jc jc2 = a11;
        jc jc3 = a11;
        jc jc4 = a11;
        a11.a = a3;
        jc4.M = a4;
        jc4.A = a5;
        jc3.K = a6;
        jc3.j = a9;
        jc2.D = a10;
        jc2.C = a7;
        a11.c = a8;
        a11.E(a2);
    }

    @Override
    public void A(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        jc a8;
        Graphics2D graphics2D = a7;
        jc jc2 = a8;
        a7.setFont(jc2.j);
        graphics2D.setColor(jc2.D);
        graphics2D.drawString(a8.E, a2 + a8.a, a3 + a8.A + (Integer)a8.H.getRight());
    }

    public void E(float a2) {
        jc a3;
        jc jc2 = a3;
        jc2.j = jc2.j.deriveFont(a2);
        jc2.E(jc2.E);
    }

    @Override
    public void g(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        jc a8;
        Graphics2D graphics2D = a7;
        jc jc2 = a8;
        a7.setFont(jc2.j);
        graphics2D.setColor(jc2.D);
        graphics2D.drawString(a8.E, a2 + (a4 - (Integer)a8.H.getLeft() - a8.M), a3 + (a5 - (Integer)a8.H.getMiddle() - a8.K) + (Integer)a8.H.getRight());
    }

    @Override
    public void E(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        jc a8;
        Graphics2D graphics2D = a7;
        jc jc2 = a8;
        a7.setFont(jc2.j);
        graphics2D.setColor(jc2.D);
        graphics2D.drawString(a8.E, a2 + (a4 - (Integer)a8.H.getLeft()) / 2, a3 + (a5 - (Integer)a8.H.getMiddle() - a8.K) + (Integer)a8.H.getRight());
    }

    @Override
    public void E(int a2) {
        jc a3;
        a3.D = he_1.E(a3.D, a2);
    }

    public Color E() {
        jc a2;
        return a2.D;
    }

    @Override
    public void H(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        jc a8;
        Graphics2D graphics2D = a7;
        jc jc2 = a8;
        a7.setFont(jc2.j);
        graphics2D.setColor(jc2.D);
        graphics2D.drawString(a8.E, a2 + (a4 - (Integer)a8.H.getLeft() - a8.M), a3 + a8.A + (Integer)a8.H.getRight());
    }

    @Override
    public int a() {
        jc a2;
        return a2.h;
    }
}

