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
import ttw.tradefinder.h_0;
import ttw.tradefinder.he_1;
import ttw.tradefinder.m_0;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.Bb
 */
public abstract class bb_0
extends KB
implements m_0 {
    private String B;
    private Color K;
    private Font E;
    private final int j;
    private Triple<Integer, Integer, Integer> a;
    private int h;
    private final h_0 H;
    private final int D;
    private int A;
    private final int C;
    private final int M;
    private final int b;
    private final int c;

    @Override
    public int E() {
        bb_0 a2;
        return a2.h;
    }

    public Color E() {
        bb_0 a2;
        return a2.K;
    }

    @Override
    public void g(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        bb_0 a8;
        bb_0 bb_02 = a8;
        bb_02.H.a(a2, a3, a4, a5, a7);
        Graphics2D graphics2D = a7;
        bb_0 bb_03 = a8;
        a7.setFont(bb_03.E);
        graphics2D.setColor(bb_03.K);
        graphics2D.drawString(bb_02.B, a2 + (a4 - (Integer)a8.a.getLeft() - a8.M), a3 + (a5 - (Integer)a8.a.getMiddle()) + (Integer)a8.a.getRight() + a8.c);
    }

    public bb_0(String a2, int a3, int a4, int a5, int a6, int a7, Font a8, Color a9, h_0 a10) {
        a11(a2, a3, a4, a5, 0, a6, a7, a8, a9, a10);
        bb_0 a11;
    }

    @Override
    public void H(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        bb_0 a8;
        bb_0 bb_02 = a8;
        bb_02.H.a(a2, a3, a4, a5, a7);
        Graphics2D graphics2D = a7;
        bb_0 bb_03 = a8;
        a7.setFont(bb_03.E);
        graphics2D.setColor(bb_03.K);
        graphics2D.drawString(bb_02.B, a2 + (a4 - (Integer)a8.a.getLeft() - a8.M), a3 + (Integer)a8.a.getRight() + a8.c);
    }

    @Override
    public int E(int a2) {
        bb_0 a3;
        return (Integer)a3.a.getLeft() + 2 * a2;
    }

    public bb_0(String a2, int a3, int a4, int a5, int a6, int a7, int a8, Font a9, Color a10, h_0 a11) {
        bb_0 a12;
        bb_0 bb_02 = a12;
        bb_0 bb_03 = a12;
        bb_0 bb_04 = a12;
        bb_0 bb_05 = a12;
        bb_05.C = a3;
        bb_05.M = a4;
        bb_04.D = a5;
        bb_04.c = a6;
        bb_03.E = a9;
        bb_03.K = a10;
        bb_02.H = a11;
        bb_02.b = a7;
        a12.j = a8;
        a12.E(a2);
    }

    @Override
    public void f(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        bb_0 a8;
        bb_0 bb_02 = a8;
        bb_02.H.a(a2, a3, a4, a5, a7);
        Graphics2D graphics2D = a7;
        bb_0 bb_03 = a8;
        a7.setFont(bb_03.E);
        graphics2D.setColor(bb_03.K);
        graphics2D.drawString(bb_02.B, a2 + (a4 - (Integer)a8.a.getLeft() - a8.M), a3 + (a5 - (Integer)a8.a.getMiddle()) / 2 + (Integer)a8.a.getRight() + a8.c);
    }

    @Override
    public void E(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        bb_0 a8;
        bb_0 bb_02 = a8;
        bb_02.H.j(a2, a3, a4, a5, a7);
        Graphics2D graphics2D = a7;
        bb_0 bb_03 = a8;
        a7.setFont(bb_03.E);
        graphics2D.setColor(bb_03.K);
        graphics2D.drawString(bb_02.B, a2 + (a4 - (Integer)a8.a.getLeft()) / 2, a3 + (a5 - (Integer)a8.a.getMiddle()) + (Integer)a8.a.getRight() + a8.c);
    }

    @Override
    public int j(int a2) {
        bb_0 a3;
        return (Integer)a3.a.getMiddle() + 2 * a2;
    }

    @Override
    public void a(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        bb_0 a8;
        bb_0 bb_02 = a8;
        bb_02.H.j(a2, a3, a4, a5, a7);
        Graphics2D graphics2D = a7;
        bb_0 bb_03 = a8;
        a7.setFont(bb_03.E);
        graphics2D.setColor(bb_03.K);
        graphics2D.drawString(bb_02.B, a2 + (a4 - (Integer)a8.a.getLeft()) / 2, a3 + (Integer)a8.a.getRight() + a8.c);
    }

    public bb_0(String a2, int a3, int a4, int a5, int a6, Font a7, Color a8, h_0 a9) {
        bb_0 a10;
        int n2 = a3;
        a10(a2, n2, n2, a4, 0, a5, a6, a7, a8, a9);
    }

    @Override
    public int j() {
        return 0;
    }

    @Override
    public void A(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        bb_0 a8;
        bb_0 bb_02 = a8;
        bb_02.H.E(a2, a3, a4, a5, a7);
        Graphics2D graphics2D = a7;
        bb_0 bb_03 = a8;
        a7.setFont(bb_03.E);
        graphics2D.setColor(bb_03.K);
        graphics2D.drawString(bb_02.B, a2 + a8.C, a3 + (Integer)a8.a.getRight() + a8.c);
    }

    @Override
    public void j(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        bb_0 a8;
        bb_0 bb_02 = a8;
        bb_02.H.E(a2, a3, a4, a5, a7);
        Graphics2D graphics2D = a7;
        bb_0 bb_03 = a8;
        a7.setFont(bb_03.E);
        graphics2D.setColor(bb_03.K);
        graphics2D.drawString(bb_02.B, a2 + a8.C, a3 + (a5 - (Integer)a8.a.getMiddle()) + (Integer)a8.a.getRight() + a8.c);
    }

    @Override
    public void d(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        bb_0 a8;
        bb_0 bb_02 = a8;
        bb_02.H.j(a2, a3, a4, a5, a7);
        Graphics2D graphics2D = a7;
        bb_0 bb_03 = a8;
        a7.setFont(bb_03.E);
        graphics2D.setColor(bb_03.K);
        graphics2D.drawString(bb_02.B, a2 + (a4 - (Integer)a8.a.getLeft()) / 2, a3 + (a5 - (Integer)a8.a.getMiddle()) / 2 + (Integer)a8.a.getRight() + a8.c);
    }

    @Override
    public void E(Color a2, int a3) {
        bb_0 a4;
        a4.K = a2;
        a4.H.E(a3);
    }

    @Override
    public void l(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        bb_0 a8;
        bb_0 bb_02 = a8;
        bb_02.H.E(a2, a3, a4, a5, a7);
        Graphics2D graphics2D = a7;
        bb_0 bb_03 = a8;
        a7.setFont(bb_03.E);
        graphics2D.setColor(bb_03.K);
        graphics2D.drawString(bb_02.B, a2 + a8.C, a3 + (a5 - (Integer)a8.a.getMiddle()) / 2 + (Integer)a8.a.getRight() + a8.c);
    }

    @Override
    public int a() {
        bb_0 a2;
        return a2.A;
    }

    @Override
    public void E(int a2) {
        bb_0 a3;
        bb_0 bb_02 = a3;
        bb_02.K = he_1.E(bb_02.K, a2);
        bb_02.H.E(a2);
    }

    public void E(float a2) {
        bb_0 a3;
        bb_0 bb_02 = a3;
        bb_02.E = bb_02.E.deriveFont(a2);
        bb_02.E(bb_02.B);
    }

    public /* synthetic */ void E(String a2) {
        bb_0 a3;
        a3.B = a2;
        bb_0 bb_02 = a3;
        a3.a = a3.E(bb_02.E, a3.B);
        bb_02.h = Math.max((Integer)bb_02.a.getMiddle() + 2 * a3.D, a3.j);
        a3.A = Math.max((Integer)a3.a.getLeft() + a3.M + a3.C, a3.b);
    }
}

