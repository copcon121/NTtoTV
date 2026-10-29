/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
 *  org.apache.commons.lang3.tuple.Triple
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.commons.lang3.tuple.Triple;
import ttw.tradefinder.KB;
import ttw.tradefinder.he_1;
import ttw.tradefinder.m_0;

/*
 * Renamed from ttw.tradefinder.AA
 */
public abstract class aa_1
extends KB
implements m_0 {
    private Triple<Integer, Integer, Integer> h;
    private List<Triple<String, Color, Integer>> H;
    private final int D;
    private Font A;
    private int C;
    private int M;
    private final int b;
    private final int c;

    @Override
    public void j(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        aa_1 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public void A(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        aa_1 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public void E(Color a2, int a3) {
        aa_1 a4;
        a4.void_E(a3);
    }

    @Override
    public int j(int a2) {
        aa_1 a3;
        return (Integer)a3.h.getMiddle() + 2 * a2;
    }

    @Override
    public int a() {
        aa_1 a2;
        return a2.M;
    }

    @Override
    public int int_E() {
        aa_1 a2;
        return a2.C;
    }

    @Override
    public void l(int a2, int a3, int a4, int a52, int a6, Graphics2D a7) {
        aa_1 a8;
        a7.setFont(a8.A);
        a2 += a8.c;
        a3 = a3 + (a52 - (Integer)a8.h.getMiddle()) / 2 + (Integer)a8.h.getRight();
        Iterator<Triple<String, Color, Integer>> iterator = a4 = a8.H.iterator();
        while (iterator.hasNext()) {
            Triple<String, Color, Integer> a52 = a4.next();
            a7.setColor((Color)a52.getMiddle());
            a7.drawString((String)a52.getLeft(), a2, a3);
            a2 += ((Integer)a52.getRight()).intValue();
            iterator = a4;
        }
    }

    @Override
    public void H(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        aa_1 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public void g(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        aa_1 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public int int_E(int a2) {
        aa_1 a3;
        return (Integer)a3.h.getLeft() + 2 * a2;
    }

    private /* synthetic */ String E(List<Triple<String, Color, Integer>> a2) {
        Object object = "";
        Object object2 = a2 = a2.iterator();
        while (object2.hasNext()) {
            Triple triple = (Triple)a2.next();
            object = (String)object + (String)triple.getLeft();
            object2 = a2;
        }
        return object;
    }

    @Override
    public void void_E(int a2) {
        aa_1 a3;
        Iterator<Triple<String, Color, Integer>> iterator;
        ArrayList<Triple<String, Color, Integer>> arrayList = new ArrayList<Triple<String, Color, Integer>>();
        Iterator<Triple<String, Color, Integer>> iterator2 = iterator = a3.H.iterator();
        while (iterator2.hasNext()) {
            Triple<String, Color, Integer> triple = iterator.next();
            arrayList.add((Triple<String, Color, Integer>)Triple.of((Object)((String)triple.getLeft()), (Object)he_1.E((Color)triple.getMiddle(), a2), (Object)((Integer)triple.getRight())));
            iterator2 = iterator;
        }
        a3.H = arrayList;
    }

    public aa_1(List<Pair<String, Color>> a2, int a3, int a4, int a5, Font a6) {
        aa_1 a7;
        aa_1 aa_12 = a7;
        aa_1 aa_13 = a7;
        aa_1 aa_14 = a7;
        aa_14.A = a6;
        aa_14.c = a3;
        aa_13.b = a4;
        aa_13.D = a5;
        aa_1 aa_15 = a7;
        aa_12.H = aa_12.j(aa_15.A, a2);
        aa_1 aa_16 = a7;
        aa_15.h = aa_15.E(a7.A, aa_16.E(aa_16.H));
        aa_12.C = Math.max((Integer)aa_12.h.getMiddle() + 2 * a3, a5);
        a7.M = Math.max((Integer)a7.h.getLeft() + 2 * a3, a4);
    }

    @Override
    public void E(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        aa_1 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public int j() {
        return 0;
    }

    @Override
    public void f(int a2, int a3, int a4, int a52, int a6, Graphics2D a7) {
        aa_1 a8;
        a7.setFont(a8.A);
        a2 += a4 - (Integer)a8.h.getLeft() - a8.c;
        a3 = a3 + (a52 - (Integer)a8.h.getMiddle()) / 2 + (Integer)a8.h.getRight();
        Iterator<Triple<String, Color, Integer>> iterator = a4 = a8.H.iterator();
        while (iterator.hasNext()) {
            Triple<String, Color, Integer> a52 = a4.next();
            a7.setColor((Color)a52.getMiddle());
            a7.drawString((String)a52.getLeft(), a2, a3);
            a2 += ((Integer)a52.getRight()).intValue();
            iterator = a4;
        }
    }

    @Override
    public void a(int a2, int a3, int a4, int a5, int a6, Graphics2D a7) {
        aa_1 a8;
        a8.d(a2, a3, a4, a5, a6, a7);
    }

    @Override
    public void d(int a2, int a3, int a4, int a52, int a6, Graphics2D a7) {
        aa_1 a8;
        a7.setFont(a8.A);
        a2 += (a4 - (Integer)a8.h.getLeft()) / 2;
        a3 = a3 + (a52 - (Integer)a8.h.getMiddle()) / 2 + (Integer)a8.h.getRight();
        Iterator<Triple<String, Color, Integer>> iterator = a4 = a8.H.iterator();
        while (iterator.hasNext()) {
            Triple<String, Color, Integer> a52 = a4.next();
            a7.setColor((Color)a52.getMiddle());
            a7.drawString((String)a52.getLeft(), a2, a3);
            a2 += ((Integer)a52.getRight()).intValue();
            iterator = a4;
        }
    }

    public void E(float a2) {
        aa_1 a3;
        aa_1 aa_12 = a3;
        aa_12.A = aa_12.A.deriveFont(a2);
        aa_1 aa_13 = a3;
        aa_12.H = aa_12.E(aa_13.A, a3.H);
        aa_1 aa_14 = a3;
        aa_13.h = aa_13.E(a3.A, aa_14.E(aa_14.H));
        aa_12.C = Math.max((Integer)aa_12.h.getMiddle() + 2 * a3.c, a3.D);
        a3.M = Math.max((Integer)a3.h.getLeft() + 2 * a3.c, a3.b);
    }
}

