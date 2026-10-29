/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
 *  org.apache.commons.lang3.tuple.Triple
 *  velox.gui.colors.Colors
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.font.FontRenderContext;
import java.awt.font.GlyphVector;
import java.awt.image.BufferedImage;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.commons.lang3.tuple.Triple;
import ttw.tradefinder.dc;
import ttw.tradefinder.he_1;
import ttw.tradefinder.ub;
import ttw.tradefinder.ze_2;
import velox.gui.colors.Colors;

public class Pd {
    private static double b;
    private static Font c;

    public BufferedImage E(Pair<Double, Double> a2, double a3, int a4, int a5, ze_2 a6) {
        if (a4 < 10) {
            return new BufferedImage(1, 1, 2);
        }
        BufferedImage bufferedImage = new BufferedImage(a4, a5, 2);
        Graphics2D graphics2D = bufferedImage.createGraphics();
        graphics2D.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Graphics2D graphics2D2 = graphics2D;
        Graphics2D graphics2D3 = graphics2D;
        graphics2D3.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics2D3.setColor(Colors.TRANSPARENT);
        graphics2D2.fillRect(0, 0, bufferedImage.getWidth(), bufferedImage.getHeight());
        graphics2D2.setColor(he_1.c);
        graphics2D2.fillRect(a4 / 2, 0, (int)((double)(a4 / 2) / a3 * (Double)a2.getLeft()), a5);
        graphics2D.setColor(he_1.j);
        int n2 = (int)((double)(a4 / 2) / a3 * (Double)a2.getRight());
        graphics2D.fillRect(a4 / 2 - n2, 0, n2, a5);
        if (a5 >= 8 && ((Double)a2.getLeft() > b * a3 || (Double)a2.getRight() > b * a3)) {
            Triple<Integer, Integer, Integer> triple;
            String string;
            float f2 = a5;
            if (a5 >= 12) {
                f2 = Math.min((int)((double)a5 * 0.9), 14);
            }
            Font font = c.deriveFont(f2);
            Graphics2D graphics2D4 = graphics2D;
            graphics2D4.setFont(font);
            graphics2D4.setColor(Color.WHITE);
            if ((Double)a2.getLeft() > b * a3) {
                string = a6.java_lang_String_E((Double)a2.getLeft());
                triple = dc.E(string, font);
                graphics2D.drawString(string, a4 / 2 + 4, (a5 - (Integer)triple.getMiddle()) / 2 + (Integer)triple.getRight());
            }
            if ((Double)a2.getRight() > b * a3) {
                string = a6.java_lang_String_E((Double)a2.getRight());
                triple = dc.E(string, font);
                graphics2D.drawString(string, a4 / 2 - 4 - (Integer)triple.getLeft(), (a5 - (Integer)triple.getMiddle()) / 2 + (Integer)triple.getRight());
            }
        }
        graphics2D.dispose();
        return bufferedImage;
    }

    public BufferedImage E(double a22, double a32, int a4, ze_2 a52) {
        if (a4 < 20) {
            return new BufferedImage(1, 1, 2);
        }
        String a22 = a52.java_lang_String_E(a22) + " - " + a52.java_lang_String_E(a32);
        Font font = c.deriveFont(14.0f);
        Triple<Integer, Integer, Integer> a32 = Pd.E(a22, font);
        int n2 = (Integer)a32.getMiddle() + 6;
        int a52 = a4 / 2;
        BufferedImage bufferedImage = new BufferedImage(a4, n2, 2);
        Graphics2D graphics2D = bufferedImage.createGraphics();
        graphics2D.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Graphics2D graphics2D2 = graphics2D;
        Graphics2D graphics2D3 = graphics2D;
        Graphics2D graphics2D4 = graphics2D;
        Graphics2D graphics2D5 = graphics2D;
        Graphics2D graphics2D6 = graphics2D;
        graphics2D.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics2D6.setColor(Colors.TRANSPARENT);
        graphics2D6.fillRect(0, 0, a4, n2);
        graphics2D6.setColor(he_1.j);
        graphics2D5.fillRoundRect(0, 0, a52, n2, 3, 3);
        graphics2D5.fillRect(3, 0, a52 - 2, n2);
        graphics2D5.setColor(he_1.c);
        int n3 = a52;
        graphics2D4.fillRoundRect(n3, 0, a4 - n3, n2, 3, 3);
        graphics2D4.fillRect(a52, 0, a4 - a52 - 3, n2);
        graphics2D4.setColor(he_1.D);
        graphics2D3.fillRoundRect(2, 2, a4 - 4, n2 - 4, 2, 2);
        graphics2D3.setFont(font);
        graphics2D2.setColor(Color.WHITE);
        graphics2D2.drawString(a22, a52 - (Integer)a32.getLeft() / 2, (Integer)a32.getRight() + 3);
        graphics2D.dispose();
        return bufferedImage;
    }

    public static Triple<Integer, Integer, Integer> E(String a2, Font a3) {
        if (((String)a2).isEmpty()) {
            return Triple.of((Object)0, (Object)0, (Object)0);
        }
        Object object = new BufferedImage(1, 1, 2);
        object = ((BufferedImage)object).createGraphics();
        ((Graphics2D)object).setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Object object2 = object;
        ((Graphics)object2).setFont((Font)a3);
        a3 = ((Graphics2D)object2).getFontRenderContext();
        a2 = ((Graphics)object2).getFont().createGlyphVector((FontRenderContext)a3, (String)a2);
        a2 = ((GlyphVector)a2).getPixelBounds((FontRenderContext)a3, 0.0f, 0.0f);
        a2 = Triple.of((Object)((int)((Rectangle)a2).getWidth()), (Object)((int)((Rectangle)a2).getHeight()), (Object)(-((Rectangle)a2).y));
        ((Graphics)object2).dispose();
        return a2;
    }

    static {
        c = new Font(ub.E(":\u0016\u0012\u0005\u0017"), 0, 10);
        b = 0.5;
    }

    public Pd() {
        Pd a2;
    }
}

