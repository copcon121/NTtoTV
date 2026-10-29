/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Triple
 */
package ttw.tradefinder;

import java.awt.Graphics2D;
import java.util.Iterator;
import java.util.List;
import org.apache.commons.lang3.tuple.Triple;
import ttw.tradefinder.KC;
import ttw.tradefinder.dc_2;
import ttw.tradefinder.he_1;
import ttw.tradefinder.m_0;
import ttw.tradefinder.mb_2;

/*
 * Renamed from ttw.tradefinder.Od
 */
public class od_0 {
    private final KC K;
    private static final int E = 6;
    private static final int j = 8;
    private final int a;
    private static final int h = 6;
    private final m_0 H;
    private static final int D = 6;
    private final m_0 A;
    private int C;
    private static final int M = 2;
    private final List<m_0> b;
    private static final int c = 3;

    public od_0(String a2, m_0 a3, m_0 a4, List<m_0> a5, int a6) {
        od_0 a7;
        od_0 od_02 = a7;
        od_0 od_03 = a7;
        a7.K = new KC(a2);
        a7.A = a3;
        od_03.H = a4;
        od_03.b = a5;
        od_02.a = a6;
        od_02.C = a6;
    }

    public void E(float a2) {
        Iterator<m_0> iterator;
        od_0 a3;
        od_0 od_02 = a3;
        od_02.C = (int)((float)od_02.a * a2);
        od_02.K.E((double)a2);
        od_02.A.E(a2);
        od_02.H.E(a2);
        Iterator<m_0> iterator2 = iterator = od_02.b.iterator();
        while (iterator2.hasNext()) {
            iterator.next().E(a2);
            iterator2 = iterator;
        }
    }

    public Triple<Integer, Integer, Integer> E(dc_2 a222) {
        dc_2 a222;
        od_0 a3;
        if (a222.b == mb_2.b) {
            return Triple.of((Object)(Math.max(a3.K.a(), a3.A.a()) + 8), (Object)0, (Object)(a3.K.int_E() + a3.A.int_E()));
        }
        if (a222.b == mb_2.C) {
            od_0 od_02 = a3;
            int a222 = Math.max(a3.K.a(), od_02.H.a());
            int n2 = od_02.K.int_E() + a3.H.int_E();
            return Triple.of((Object)(a222 + a3.A.a() + 8), (Object)0, (Object)Math.max(n2, a3.A.int_E()));
        }
        if (a222.b == mb_2.c) {
            Iterator<m_0> iterator;
            od_0 od_03 = a3;
            od_0 od_04 = a3;
            int a222 = Math.max(od_03.K.a(), od_04.H.a());
            int n3 = od_03.K.int_E() + a3.H.int_E();
            a222 = a222 + a3.A.a() + 8;
            n3 = Math.max(n3, a3.A.int_E());
            int n4 = 0;
            int n5 = 0;
            int n6 = 0;
            Iterator<m_0> iterator2 = iterator = od_04.b.iterator();
            while (iterator2.hasNext()) {
                m_0 m_02 = iterator.next();
                n5 = Math.max(n5, m_02.a() - m_02.j() + 6);
                n6 = Math.max(n6, m_02.j());
                n4 += m_02.int_E();
                iterator2 = iterator;
            }
            a3.C = Math.max(a222, a3.C);
            return Triple.of((Object)Math.max(n6 + n5, a3.C), (Object)n6, (Object)(n3 + n4 + 3));
        }
        return Triple.of((Object)0, (Object)0, (Object)0);
    }

    public void E(Graphics2D a2, int a3, int a4, Triple<Integer, Integer, Integer> a5, dc_2 a622) {
        dc_2 a622;
        od_0 a7;
        if (a622.b == mb_2.b) {
            Graphics2D graphics2D = a2;
            graphics2D.setColor(he_1.D);
            graphics2D.fillRect(a3, a4, (Integer)a5.getLeft(), (Integer)a5.getRight());
            Graphics2D graphics2D2 = a2;
            graphics2D2.setColor(he_1.H);
            graphics2D2.fillRect(a3 + 6, a4 + 6, 2, (Integer)a5.getRight() - 12);
            int a622 = (Integer)a5.getLeft() - 8;
            od_0 od_02 = a7;
            od_02.K.A(a3 + 8, a4, a622, a7.K.int_E(), 0, a2);
            od_02.A.a(a3 + 8, a4 + a7.K.int_E(), a622, a7.A.int_E(), 0, a2);
            return;
        }
        if (a622.b == mb_2.C) {
            Graphics2D graphics2D = a2;
            graphics2D.setColor(he_1.D);
            graphics2D.fillRect(a3, a4, (Integer)a5.getLeft(), (Integer)a5.getRight());
            Graphics2D graphics2D3 = a2;
            graphics2D3.setColor(he_1.H);
            graphics2D3.fillRect(a3 + 6, a4 + 6, 2, (Integer)a5.getRight() - 12);
            int a622 = (Integer)a5.getLeft() - 8;
            od_0 od_03 = a7;
            od_03.K.A(a3 + 8, a4, a622 - a7.A.a(), a7.K.int_E(), 0, a2);
            od_03.H.A(a3 + 8, a4 + a7.K.int_E(), a622 - a7.A.a(), a7.H.int_E(), 0, a2);
            od_03.A.d(a3 + 8 + a622 - a7.A.a(), a4, a7.A.a(), (Integer)a5.getRight(), 0, a2);
            return;
        }
        if (a622.b == mb_2.c) {
            int a622 = Math.max(a7.K.int_E() + a7.H.int_E(), a7.A.int_E());
            int n2 = (Integer)a5.getLeft() - 8;
            Graphics2D graphics2D = a2;
            graphics2D.setColor(he_1.D);
            graphics2D.fillRect(a3, a4, (Integer)a5.getLeft(), (Integer)a5.getRight());
            Graphics2D graphics2D4 = a2;
            graphics2D4.setColor(he_1.H);
            graphics2D4.fillRect(a3 + 6, a4 + 6, 2, a622 - 12);
            od_0 od_04 = a7;
            od_04.K.A(a3 + 8, a4, n2 - a7.A.a(), a7.K.int_E(), 0, a2);
            od_04.H.A(a3 + 8, a4 + a7.K.int_E(), n2 - a7.A.a(), a7.H.int_E(), 0, a2);
            a7.A.f(a3 + 8 + n2 - a7.A.a(), a4, a7.A.a(), a622, 0, a2);
            a4 += a622;
            Iterator<m_0> iterator = a622 = od_04.b.iterator();
            while (iterator.hasNext()) {
                m_0 m_02 = a622.next();
                m_02.d(a3, a4, (Integer)a5.getLeft() - 6, m_02.int_E(), (Integer)a5.getMiddle(), a2);
                a4 += m_02.int_E();
                iterator = a622;
            }
        }
    }
}

