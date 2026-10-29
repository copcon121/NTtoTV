/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Triple
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$HorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativeDataHorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativeDataVerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativeHorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativePixelHorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativePixelVerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativeVerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$VerticalCoordinate
 *  velox.gui.colors.Colors
 */
package ttw.tradefinder;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import org.apache.commons.lang3.tuple.Triple;
import ttw.tradefinder.Ff;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.gui.colors.Colors;

/*
 * Renamed from ttw.tradefinder.fb
 */
public class fb_0 {
    public static int c = 25;

    public Triple<ScreenSpaceCanvas.HorizontalCoordinate, ScreenSpaceCanvas.VerticalCoordinate, BufferedImage> E() {
        ScreenSpaceCanvas.RelativeDataHorizontalCoordinate relativeDataHorizontalCoordinate = new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_DATA_ZERO, 0L);
        ScreenSpaceCanvas.RelativeDataVerticalCoordinate relativeDataVerticalCoordinate = new ScreenSpaceCanvas.RelativeDataVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_DATA_ZERO, 0.0);
        return Triple.of((Object)relativeDataHorizontalCoordinate, (Object)relativeDataVerticalCoordinate, (Object)new BufferedImage(1, 1, 2));
    }

    public fb_0() {
        fb_0 a2;
    }

    public Triple<ScreenSpaceCanvas.HorizontalCoordinate, ScreenSpaceCanvas.VerticalCoordinate, BufferedImage> E(Ff a322, int a23, int a4, long a2222, long a52, long a6, long a72, long a8, Color a9) {
        long l2 = a8 + a2222;
        Ff ff = a322;
        Ff ff2 = a322;
        int a72 = Math.max(ff.M, ff2.b);
        int n2 = Math.min(ff.M, a322.b);
        long l3 = ff2.c;
        double d2 = (double)a52 / (double)a4;
        double d3 = (double)a23 / (double)a2222;
        a23 = c;
        long l4 = ff.C - Math.max(l3, a6);
        int a2222 = (int)((double)a4 / (double)a52 * (double)l4) + 2 * c;
        a4 = Math.min(0, (int)((double)a4 / (double)a52 * (double)(l3 - a6)));
        l4 = Math.min(l2, (long)a72) - Math.max(a8, (long)n2);
        int n3 = (int)(d3 * (double)l4) + 2 * a23;
        int a52 = Math.min(0, (int)(d3 * (double)(l2 - (long)a72)));
        if (a2222 <= 0 || n3 <= 0) {
            fb_0 a10;
            return a10.E();
        }
        BufferedImage a2222 = new BufferedImage(a2222, n3, 2);
        Graphics2D graphics2D = a2222.createGraphics();
        graphics2D.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Graphics2D graphics2D2 = graphics2D;
        Ff ff3 = a322;
        Graphics2D graphics2D3 = graphics2D;
        Graphics2D graphics2D4 = graphics2D;
        Graphics2D graphics2D5 = graphics2D;
        graphics2D5.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics2D5.setColor(Colors.TRANSPARENT);
        graphics2D5.fillRect(0, 0, a2222.getWidth(), a2222.getHeight());
        graphics2D4.translate(a4 + c, a52 + a23);
        graphics2D4.setColor(a9);
        graphics2D3.setStroke(new BasicStroke(2.0f));
        a4 = (int)((double)(ff3.c - l3) / d2);
        a52 = (int)((double)(a72 - a322.b) * d3);
        int n4 = (int)((double)(ff3.C - l3) / d2);
        int a322 = (int)((double)(a72 - a322.M) * d3);
        int n5 = a4;
        graphics2D3.drawLine(n5, a52, n5, a322);
        graphics2D2.fillOval(a4 - 6, a52 - 6, 12, 12);
        int n6 = a322;
        graphics2D2.drawLine(a4, n6, n4, n6);
        graphics2D2.fillOval(n4 - 6, a322 - 6, 12, 12);
        graphics2D2.dispose();
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate a322 = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_DATA_ZERO, Math.max(l3, a6)), -c);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate a23 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)new ScreenSpaceCanvas.RelativeDataVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_DATA_ZERO, (double)((int)Math.max(a8, (long)n2))), -a23);
        return Triple.of((Object)a322, (Object)a23, (Object)a2222);
    }
}

