/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.ArrayUtils
 *  org.apache.commons.lang3.tuple.Pair
 *  velox.gui.colors.Colors
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.LinearGradientPaint;
import java.awt.Paint;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.geom.GeneralPath;
import java.awt.geom.Path2D;
import java.awt.geom.Point2D;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.List;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.tuple.Pair;
import ttw.tradefinder.ca_1;
import ttw.tradefinder.ge_1;
import ttw.tradefinder.hd;
import ttw.tradefinder.he_1;
import ttw.tradefinder.qc_0;
import ttw.tradefinder.yb_0;
import ttw.tradefinder.za_1;
import ttw.tradefinder.zc_1;
import velox.gui.colors.Colors;

/*
 * Renamed from ttw.tradefinder.cB
 */
public class cb_0 {
    public static int b;
    public static int c;

    public static GeneralPath E(List<Point2D.Float> a2) {
        int n2;
        GeneralPath generalPath = new GeneralPath();
        generalPath.moveTo(a2.get((int)0).x, a2.get((int)0).y);
        int n3 = n2 = 1;
        while (n3 < a2.size() - 1) {
            Point2D.Float float_ = a2.get(n2 - 1);
            Point2D.Float float_2 = a2.get(n2);
            Point2D.Float float_3 = a2.get(n2 + 1);
            float_ = cb_0.E(float_, float_2);
            GeneralPath generalPath2 = generalPath;
            Point2D.Float float_4 = float_;
            generalPath2.lineTo(float_4.x, float_4.y);
            float_ = cb_0.E(float_3, float_2);
            Point2D.Float float_5 = float_2;
            Point2D.Float float_6 = float_2;
            Point2D.Float float_7 = float_;
            generalPath2.curveTo(float_5.x, float_5.y, float_6.x, float_6.y, float_7.x, float_7.y);
            n3 = ++n2;
        }
        generalPath.lineTo(a2.get((int)n2).x, a2.get((int)n2).y);
        return generalPath;
    }

    private static /* synthetic */ Point2D.Float E(Point2D.Float a22, Point2D.Float a32) {
        Point2D.Float float_ = a22;
        Point2D.Float float_2 = a22;
        double d2 = Math.sqrt(Math.pow(float_.x - a32.x, 2.0) + Math.pow(float_2.y - a32.y, 2.0));
        d2 = 10.0 / d2;
        Point2D.Float float_3 = a32;
        double d3 = (double)(float_2.x - float_3.x) * d2;
        d2 = (double)(float_.y - a32.y) * d2;
        float a22 = (float)((double)a32.x + d3);
        float a32 = (float)((double)float_3.y + d2);
        return new Point2D.Float(a22, a32);
    }

    public static BufferedImage E(ca_1 a2, long a3, ge_1 a4, double a52) {
        Graphics2D graphics2D;
        if (a4.int_j() < 10) {
            return new BufferedImage(1, 1, 2);
        }
        Pair<Integer, Integer> pair = cb_0.E(a2.h, qc_0.M);
        int n2 = (Integer)pair.getRight();
        int n3 = 10 * a4.int_j();
        BufferedImage bufferedImage = new BufferedImage(n3, n2, 2);
        Graphics2D graphics2D2 = bufferedImage.createGraphics();
        graphics2D2.setColor(Colors.TRANSPARENT);
        Graphics2D graphics2D3 = graphics2D2;
        graphics2D3.fillRect(0, 0, n3, n2);
        graphics2D3.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics2D3.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        ArrayList<Float> arrayList = new ArrayList<Float>();
        ArrayList<Color> arrayList2 = new ArrayList<Color>();
        float f2 = (float)a4.int_j() - 2.0f;
        float a52 = (float)(1.0 - a52 / (double)f2) / f2;
        float f3 = -1.0f;
        if (a2.h != hd.b) {
            int n4;
            int n5 = n4 = 0;
            while (n5 < a4.int_j()) {
                float f4;
                Color color;
                Color color2;
                long l2 = a4.long_E(n4);
                if (l2 == 0L) {
                    color2 = a2.C;
                } else {
                    ca_1 ca_12 = a2;
                    color2 = color = l2 > 0L ? ca_12.a : ca_12.A;
                }
                if (a2.c == za_1.M && l2 != 0L) {
                    f4 = Math.abs((float)l2 / (float)a3);
                    float[] fArray = Color.RGBtoHSB(color.getRed(), color.getGreen(), color.getBlue(), null);
                    float[] fArray2 = fArray;
                    fArray[1] = Math.min(1.0f, 0.2f + 0.8f * f4);
                    color = Color.getHSBColor(fArray2[0], fArray2[1], fArray2[2]);
                }
                if (!((f4 = Math.max(0.0f, Math.min(1.0f, a52 * (float)n4))) <= f3)) {
                    arrayList.add(Float.valueOf(f4));
                    arrayList2.add(color);
                    f3 = f4;
                }
                n5 = ++n4;
            }
            LinearGradientPaint linearGradientPaint = new LinearGradientPaint(0.0f, 0.0f, n3, 0.0f, ArrayUtils.toPrimitive((Float[])arrayList.toArray(new Float[0])), arrayList2.toArray(new Color[0]));
            Graphics2D graphics2D4 = graphics2D2;
            graphics2D = graphics2D4;
            graphics2D4.setPaint(linearGradientPaint);
            graphics2D4.fillRect(0, 0, n3, n2);
        } else {
            int n6;
            Path2D.Float float_ = null;
            int n7 = n2 / 2;
            float f5 = (float)((double)n7 * 0.6);
            int n8 = n6 = 0;
            while (n8 < a4.int_j()) {
                float f6;
                Color color;
                Color color3;
                long l3 = a4.long_E(n6);
                float f7 = Math.abs((float)l3 / (float)a3);
                float f8 = f5;
                float f9 = f8 - f8 * f7;
                if (l3 == 0L) {
                    color3 = a2.C;
                } else {
                    ca_1 ca_13 = a2;
                    color3 = color = l3 > 0L ? ca_13.a : ca_13.A;
                }
                if (a2.c == za_1.M && l3 != 0L) {
                    float[] fArray = Color.RGBtoHSB(color.getRed(), color.getGreen(), color.getBlue(), null);
                    float[] fArray3 = fArray;
                    fArray[1] = Math.min(1.0f, 0.2f + 0.8f * f7);
                    color = Color.getHSBColor(fArray3[0], fArray3[1], fArray3[2]);
                }
                if (!((f6 = Math.max(0.0f, Math.min(1.0f, a52 * (float)n6))) <= f3)) {
                    arrayList.add(Float.valueOf(f6));
                    arrayList2.add(color);
                    f3 = f6;
                    if (float_ == null) {
                        float_ = new GeneralPath();
                        float_.moveTo(f6 * (float)n3, f9);
                    } else {
                        float_.lineTo(f6 * (float)n3, f9);
                    }
                }
                n8 = ++n6;
            }
            LinearGradientPaint linearGradientPaint = new LinearGradientPaint(0.0f, 0.0f, n3, 0.0f, ArrayUtils.toPrimitive((Float[])arrayList.toArray(new Float[0])), arrayList2.toArray(new Color[0]));
            Graphics2D graphics2D5 = graphics2D2;
            graphics2D = graphics2D5;
            Graphics2D graphics2D6 = graphics2D2;
            graphics2D2.setPaint(linearGradientPaint);
            Path2D.Float float_2 = float_;
            float_.lineTo(n3, n7);
            float_2.lineTo(0.0f, n7);
            float_.closePath();
            graphics2D6.fill(float_2);
            AffineTransform affineTransform = AffineTransform.getScaleInstance(1.0, -1.0);
            affineTransform.translate(0.0, -(2 * n7));
            graphics2D6.transform(affineTransform);
            graphics2D5.fill(float_);
        }
        graphics2D.dispose();
        return bufferedImage;
    }

    static {
        c = 200;
        b = 24;
    }

    public static BufferedImage E(ca_1 a2) {
        Graphics2D graphics2D;
        BufferedImage bufferedImage = new BufferedImage(60, 30, 2);
        Graphics2D graphics2D2 = bufferedImage.createGraphics();
        if (a2.M == qc_0.M) {
            if (a2.b == yb_0.M) {
                Graphics2D graphics2D3 = graphics2D2;
                graphics2D2.drawImage(cb_0.E(30, 30, a2.a), 0, 0, 30, 30, null);
                graphics2D = graphics2D3;
                graphics2D3.drawImage(cb_0.E(30, 30, a2.A), 30, 0, 30, 30, null);
            } else {
                Graphics2D graphics2D4 = graphics2D2;
                graphics2D = graphics2D4;
                ca_1 ca_12 = a2;
                graphics2D4.drawImage(cb_0.E(60, 30, ca_12.a, ca_12.A), 0, 0, 60, 30, null);
            }
        } else {
            Graphics2D graphics2D5 = graphics2D2;
            graphics2D = graphics2D5;
            ca_1 ca_13 = a2;
            graphics2D5.drawImage(cb_0.E(ca_13, 10, ca_13.a), 0, 0, 30, 30, null);
            ca_1 ca_14 = a2;
            graphics2D2.drawImage(cb_0.E(ca_14, 10, ca_14.A), 30, 0, 30, 30, null);
        }
        graphics2D.dispose();
        return bufferedImage;
    }

    public cb_0() {
        cb_0 a2;
    }

    public static BufferedImage E(zc_1 a2) {
        BufferedImage bufferedImage = new BufferedImage(a2.j(), a2.E(), 2);
        Graphics2D graphics2D = bufferedImage.createGraphics();
        graphics2D.setColor(he_1.j(he_1.D, 150));
        Graphics2D graphics2D2 = graphics2D;
        graphics2D2.fillRoundRect(0, 0, bufferedImage.getWidth(), bufferedImage.getHeight(), 5, 5);
        a2.E(0, 0, graphics2D);
        graphics2D2.dispose();
        return bufferedImage;
    }

    public static BufferedImage E(ca_1 a2, int a32, Color a4) {
        Graphics2D graphics2D;
        Object object;
        ca_1 ca_12 = a2;
        Pair<Integer, Integer> pair = cb_0.E(ca_12.h, ca_12.M);
        int n2 = (Integer)pair.getLeft();
        int n3 = (Integer)pair.getRight();
        if (a2.h == hd.b) {
            int n4;
            if (a2.M != qc_0.A) {
                n2 = (int)((double)n2 * (1.0 + (double)a32 / 10.0));
                n4 = n3;
            } else {
                n2 = (int)((double)n2 + (double)a32 / 5.0);
                n4 = n3;
            }
            n3 = (int)((double)n4 * (1.0 + (double)a32 / 10.0));
        }
        if (a2.c == za_1.M) {
            float[] fArray = Color.RGBtoHSB(a4.getRed(), a4.getGreen(), a4.getBlue(), null);
            object = fArray;
            fArray[1] = Math.min(1.0f, 0.2f + 0.08f * (float)Math.max(0, Math.min(10, a32)));
            a4 = Color.getHSBColor((float)object[0], (float)object[1], (float)object[2]);
        }
        object = new BufferedImage(n2, n3, 2);
        Graphics2D a32 = ((BufferedImage)object).createGraphics();
        if (a2.M == qc_0.C) {
            Graphics2D graphics2D2 = a32;
            graphics2D = graphics2D2;
            Graphics2D graphics2D3 = a32;
            graphics2D3.setColor(Colors.TRANSPARENT);
            graphics2D3.fillRect(0, 0, n2 - 1, n3 - 1);
            graphics2D2.setColor(a4);
            graphics2D2.fillOval(0, 0, n2 - 1, n3 - 1);
        } else if (a2.M == qc_0.b || a2.M == qc_0.A) {
            graphics2D = a32;
            Graphics2D graphics2D4 = a32;
            graphics2D4.setColor(a4);
            graphics2D4.fillRect(0, 0, n2 - 1, n3 - 1);
        } else {
            graphics2D = a32;
            Graphics2D graphics2D5 = a32;
            graphics2D5.setColor(Colors.TRANSPARENT);
            graphics2D5.fillRect(0, 0, 1, 1);
        }
        graphics2D.dispose();
        return object;
    }

    private static /* synthetic */ BufferedImage E(int a2, int a3, Color a4, Color a5) {
        BufferedImage bufferedImage = new BufferedImage(a2, a3, 2);
        Graphics2D graphics2D = bufferedImage.createGraphics();
        graphics2D.setColor(Colors.TRANSPARENT);
        Graphics2D graphics2D2 = graphics2D;
        graphics2D2.fillRect(0, 0, a2, a3);
        graphics2D2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        float[] fArray = new float[]{0.0f, 0.5f, 1.0f};
        a4 = new Color[]{a4, Color.WHITE, a5};
        a4 = new LinearGradientPaint(0.0f, 0.0f, a2, 0.0f, fArray, (Color[])a4);
        Graphics2D graphics2D3 = graphics2D;
        graphics2D3.setPaint((Paint)a4);
        graphics2D3.fillRect(0, 0, a2, a3);
        graphics2D3.dispose();
        return bufferedImage;
    }

    public static int E(int a2, int a3, int a4) {
        int n2 = a4 - 2 * b;
        if (n2 <= 0) {
            return b;
        }
        a2 = (int)((double)n2 / 100.0 * (double)a2);
        return Math.max(Math.min(b + a2, a4 - b) - a3 / 2, 0);
    }

    private static /* synthetic */ BufferedImage E(int a2, int a3, Color a4) {
        BufferedImage bufferedImage = new BufferedImage(a2, a3, 2);
        Graphics2D graphics2D = bufferedImage.createGraphics();
        graphics2D.setColor(Colors.TRANSPARENT);
        Graphics2D graphics2D2 = graphics2D;
        graphics2D2.fillRect(0, 0, a2, a3);
        graphics2D2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        float[] fArray = new float[]{0.0f, 1.0f};
        a4 = new Color[]{a4, Color.WHITE};
        a4 = new LinearGradientPaint(0.0f, 0.0f, a2, 0.0f, fArray, (Color[])a4);
        Graphics2D graphics2D3 = graphics2D;
        graphics2D3.setPaint((Paint)a4);
        graphics2D3.fillRect(0, 0, a2, a3);
        graphics2D3.dispose();
        return bufferedImage;
    }

    /*
     * Enabled aggressive block sorting
     */
    private static /* synthetic */ Pair<Integer, Integer> E(hd a2, qc_0 a3) {
        switch (a3) {
            case C: 
            case b: {
                switch (a2) {
                    case b: {
                        return Pair.of((Object)13, (Object)13);
                    }
                    case c: {
                        return Pair.of((Object)10, (Object)10);
                    }
                    case M: {
                        return Pair.of((Object)15, (Object)15);
                    }
                    case A: {
                        return Pair.of((Object)22, (Object)22);
                    }
                }
                return Pair.of((Object)15, (Object)15);
            }
            case A: {
                switch (a2) {
                    case b: {
                        return Pair.of((Object)4, (Object)15);
                    }
                    case c: {
                        return Pair.of((Object)4, (Object)15);
                    }
                    case M: {
                        return Pair.of((Object)5, (Object)22);
                    }
                    case A: {
                        return Pair.of((Object)6, (Object)30);
                    }
                }
                return Pair.of((Object)4, (Object)15);
            }
            case M: {
                switch (a2) {
                    case b: {
                        return Pair.of((Object)1, (Object)40);
                    }
                    case c: {
                        return Pair.of((Object)1, (Object)20);
                    }
                    case M: {
                        return Pair.of((Object)1, (Object)30);
                    }
                    case A: {
                        return Pair.of((Object)1, (Object)40);
                    }
                }
                return Pair.of((Object)1, (Object)20);
            }
        }
        return Pair.of((Object)12, (Object)12);
    }
}

