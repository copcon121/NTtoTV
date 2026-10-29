/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.QuadCurve2D;
import java.awt.image.BufferedImage;
import ttw.tradefinder.ac_0;
import ttw.tradefinder.tb_0;

/*
 * Renamed from ttw.tradefinder.GC
 */
public class gc_0 {
    public static void j(Graphics2D a2, int a3, int a4, int a5, int a6, Color a7, Color a8, tb_0 a9) {
        Graphics2D graphics2D = a2;
        Graphics2D graphics2D2 = a2;
        Graphics2D graphics2D3 = a2;
        graphics2D3.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics2D3.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics2D2.setStroke(ac_0.E(a9.b, a9.c));
        graphics2D2.setColor(a7);
        graphics2D.draw(new QuadCurve2D.Double(a3, a4 + a6 / 2, a3 + a5 / 4, a4, a3 + a5 / 2, a4 + a6 / 2));
        graphics2D.setColor(a8);
        graphics2D.draw(new QuadCurve2D.Double(a3 + a5 / 2, a4 + a6 / 2, a3 + a5 - a5 / 4, a4 + a6, a3 + a5, a4 + a6 / 2));
    }

    public static BufferedImage j(int a2, int a3, Color a4, Color a5, tb_0 a6) {
        BufferedImage bufferedImage = new BufferedImage(a2, a3, 2);
        Graphics2D graphics2D = bufferedImage.createGraphics();
        gc_0.E(graphics2D, 0, 0, a2, a3, a4, a5, a6);
        graphics2D.dispose();
        return bufferedImage;
    }

    public static void E(Graphics2D a2, int a3, int a4, int a5, int a6, Color a7, Color a8, tb_0 a9) {
        Graphics2D graphics2D = a2;
        Graphics2D graphics2D2 = a2;
        Graphics2D graphics2D3 = a2;
        graphics2D3.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics2D3.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics2D3.setStroke(ac_0.E(a9.b, a9.c));
        graphics2D2.setColor(a7);
        graphics2D2.drawLine(a3, a4 + a6 / 4, a3 + a5, a4 + a6 / 4);
        graphics2D.setColor(a8);
        graphics2D.drawLine(a3, a4 + a6 - a6 / 4, a3 + a5, a4 + a6 - a6 / 4);
    }

    public static BufferedImage E(int a2, int a3, Color a4, Color a5, tb_0 a6) {
        BufferedImage bufferedImage = new BufferedImage(a2, a3, 2);
        Graphics2D graphics2D = bufferedImage.createGraphics();
        gc_0.j(graphics2D, 0, 0, a2, a3, a4, a5, a6);
        graphics2D.dispose();
        return bufferedImage;
    }

    public static BufferedImage E(int a2, int a3, Color a4, tb_0 a5) {
        BufferedImage bufferedImage = new BufferedImage(a2, a3, 2);
        Graphics2D graphics2D = bufferedImage.createGraphics();
        gc_0.E(graphics2D, 0, 0, a2, a3, a4, a5);
        graphics2D.dispose();
        return bufferedImage;
    }

    public gc_0() {
        gc_0 a2;
    }

    public static void E(Graphics2D a2, int a3, int a4, int a5, int a6, Color a7, tb_0 a8) {
        Graphics2D graphics2D = a2;
        Graphics2D graphics2D2 = a2;
        graphics2D2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics2D2.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics2D2.setColor(a7);
        graphics2D.setStroke(ac_0.E(a8.b, a8.c));
        graphics2D.drawLine(a3, a4 + a6 / 2, a3 + a5, a4 + a6 / 2);
    }
}

