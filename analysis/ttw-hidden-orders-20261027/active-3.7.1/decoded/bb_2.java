/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Triple
 */
package ttw.tradefinder;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.text.DecimalFormat;
import java.util.Arrays;
import org.apache.commons.lang3.tuple.Triple;
import ttw.tradefinder.Sc;
import ttw.tradefinder.aC;
import ttw.tradefinder.ac_2;
import ttw.tradefinder.bC;
import ttw.tradefinder.dc_2;
import ttw.tradefinder.ed;
import ttw.tradefinder.fB;
import ttw.tradefinder.he_1;
import ttw.tradefinder.ja_0;
import ttw.tradefinder.le_1;
import ttw.tradefinder.od_0;
import ttw.tradefinder.pb_2;
import ttw.tradefinder.rb;
import ttw.tradefinder.xc;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.bb
 */
public class bb_2 {
    private final Sc K = new Sc("DOM Level", he_1.C);
    private final rb E;
    private final rb j;
    private final od_0 a;
    private static final int h = 140;
    private final rb H;
    private final xc D;
    private final od_0 A;
    private final rb C;
    private static final int M = 4;
    private final Sc b = new Sc("Period", he_1.C);
    private final xc c;

    public void E(ac_2 a2) {
        bb_2 a3;
        a3.K.j(String.format("DOM Level %s-%s", Integer.toString(a2.M), Integer.toString(a2.b)));
        a3.b.j(String.format("Period %ss", Integer.toString(a2.c)));
    }

    public BufferedImage E(dc_2 a2) {
        bb_2 a3;
        bb_2 bb_22 = a3;
        Triple triple = bb_22.A.E(a2);
        Object object = bb_22.a.E(a2);
        triple = Triple.of((Object)Math.max((Integer)triple.getLeft(), (Integer)object.getLeft()), (Object)Math.max((Integer)triple.getMiddle(), (Integer)object.getMiddle()), (Object)Math.max((Integer)triple.getRight(), (Integer)object.getRight()));
        if (a2.M == ja_0.b) {
            object = new BufferedImage(2 * (Integer)triple.getLeft() + 4, (Integer)triple.getRight(), 2);
            Graphics2D graphics2D = object.createGraphics();
            graphics2D.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            bb_2 bb_23 = a3;
            graphics2D.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            bb_23.a.E(graphics2D, 0, 0, (Triple<Integer, Integer, Integer>)triple, a2);
            bb_23.A.E(graphics2D, (Integer)triple.getLeft() + 4, 0, (Triple<Integer, Integer, Integer>)triple, a2);
            graphics2D.dispose();
            return object;
        }
        object = new BufferedImage((Integer)triple.getLeft(), 2 * (Integer)triple.getRight() + 4, 2);
        Graphics2D graphics2D = object.createGraphics();
        graphics2D.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        bb_2 bb_24 = a3;
        graphics2D.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        bb_24.a.E(graphics2D, 0, 0, (Triple<Integer, Integer, Integer>)triple, a2);
        bb_24.A.E(graphics2D, 0, (Integer)triple.getRight() + 4, (Triple<Integer, Integer, Integer>)triple, a2);
        graphics2D.dispose();
        return object;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 5 << 4 ^ (3 << 2 ^ 1);
        int cfr_ignored_0 = 5 << 4 ^ (2 ^ 5) << 1;
        int n5 = n3;
        int n6 = 5 << 4 ^ 5;
        while (n5 >= 0) {
            int n7 = n3--;
            a2[n7] = (char)(((String)object2).charAt(n7) ^ n6);
            if (n3 < 0) break;
            int n8 = n3--;
            a2[n8] = (char)(((String)object2).charAt(n8) ^ n4);
            n5 = n3;
        }
        return new String((char[])a2);
    }

    public bb_2(ze_2 a2, int a3) {
        bb_2 a4;
        a4.D = new xc(new DecimalFormat(a2.a(1)));
        a4.c = new xc(new DecimalFormat(a2.a(1)));
        a4.E = new rb(new DecimalFormat(a2.a(1)), new ed(he_1.c, 0, 2));
        a4.j = new rb(new DecimalFormat(a2.a(1)), new ed(he_1.j, 0, 2));
        a4.H = new rb(new DecimalFormat(a2.a(1)), new ed(he_1.j, 0, 2));
        a4.C = new rb(new DecimalFormat(a2.a(1)), new ed(he_1.c, 0, 2));
        bb_2 bb_22 = a4;
        a4.A = new od_0("Avg. Liquidity", bb_22.D, bb_22.K, Arrays.asList(new aC(new fB("Ask", he_1.c), a4.E), new aC(new fB("Bid", he_1.j), a4.j)), a3);
        bb_2 bb_23 = a4;
        a4.a = new od_0("Market Vol.", bb_23.c, bb_23.b, Arrays.asList(new aC(new fB("Ask", he_1.j), a4.H), new aC(new fB("Bid", he_1.c), a4.C)), a3);
    }

    public void E(float a2) {
        bb_2 a3;
        bb_2 bb_22 = a3;
        bb_22.A.E(a2);
        bb_22.a.E(a2);
    }

    public bb_2(ze_2 a2) {
        a3(a2, 140);
        bb_2 a3;
    }

    public void E(pb_2 a2) {
        pb_2 pb_22;
        bb_2 a3;
        if (Double.isNaN(a2.A) || Double.isNaN(a2.C)) {
            bb_2 bb_22 = a3;
            bb_22.D.j(Double.NaN);
            bb_22.E.E(a2.A, 1.0);
            bb_22.j.E(a2.C, 1.0);
            pb_22 = a2;
        } else {
            bb_2 bb_23 = a3;
            bb_23.D.j((a2.A + a2.C) / 2.0);
            bb_23.E.E(a2.A, 1.0 / (Math.max(a2.A, a2.C) / a2.A));
            bb_23.j.E(a2.C, 1.0 / (Math.max(a2.A, a2.C) / a2.C));
            pb_22 = a2;
        }
        if (Double.isNaN(pb_22.M) || Double.isNaN(a2.b)) {
            bb_2 bb_24 = a3;
            bb_24.c.j(Double.NaN);
            bb_24.H.E(a2.M, 1.0);
            bb_24.C.E(a2.b, 1.0);
            return;
        }
        bb_2 bb_25 = a3;
        bb_25.c.j(a2.M + a2.b);
        bb_25.H.E(a2.M, 1.0 / (Math.max(a2.M, a2.b) / a2.M));
        bb_25.C.E(a2.b, 1.0 / (Math.max(a2.M, a2.b) / a2.b));
    }
}

