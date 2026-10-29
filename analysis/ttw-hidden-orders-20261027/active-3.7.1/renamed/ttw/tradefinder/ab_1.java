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
import ttw.tradefinder.Oe;
import ttw.tradefinder.ed_0;
import ttw.tradefinder.he_1;
import ttw.tradefinder.lc_2;
import ttw.tradefinder.uc_2;
import ttw.tradefinder.ze_2;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.gui.colors.Colors;

/*
 * Renamed from ttw.tradefinder.ab
 */
public class ab_1 {
    public static int b = 25;
    private final boolean c;

    public Triple<ScreenSpaceCanvas.HorizontalCoordinate, ScreenSpaceCanvas.VerticalCoordinate, BufferedImage> E(Oe a2, int a32, int a4, long a52, long a2222, long a6, long a72, long a8, ze_2 a92, Color a10, uc_2 a112, int a12) {
        Color color = he_1.D;
        ed_0 ed_02 = a2.C;
        synchronized (ed_02) {
            Graphics2D graphics2D;
            int n2;
            long l2;
            long l3;
            ab_1 a13;
            int n3;
            long l4 = a6 + a72;
            long l5 = a8 + a52;
            int a72 = -1;
            int n4 = Integer.MIN_VALUE;
            int n5 = Integer.MAX_VALUE;
            int n6 = 0;
            int n7 = 0;
            int n8 = n3 = 0;
            while (n8 < a2.C.int_j() && a2.C.long_E(n3) <= l4) {
                a72 = n3;
                Oe oe = a2;
                int n9 = oe.C.int_E(n3);
                int n10 = oe.C.j(n3);
                n4 = Math.max(n4, n9);
                n5 = Math.min(n5, n9);
                n6 = Math.max(n6, n10);
                n7 += Math.max(n10, 0);
                n8 = ++n3;
            }
            if (n7 == 0 || a72 == -1) {
                return a13.E();
            }
            Oe oe = a2;
            long l6 = oe.C.long_E(0);
            double d2 = (double)a2222 / (double)a4;
            double d3 = (double)a32 / (double)a52;
            Oe oe2 = a2;
            lc_2 a32 = new lc_2(oe2, a92, n7, oe2.C.int_E(a72), a13.c, l4, a112, a12);
            int a52 = Math.max(b, a32.E() + (int)d3);
            if (oe.C.j(a72) != -1) {
                l3 = l4;
                l2 = l6;
            } else {
                l3 = Math.min(a2.C.long_E(a72), l4);
                l2 = l6;
            }
            long l7 = l3 - Math.max(l2, a6);
            int n11 = (int)((double)a4 / (double)a2222 * (double)l7) + b + a32.j() + (int)d3;
            a4 = Math.min(0, (int)((double)a4 / (double)a2222 * (double)(l6 - a6)));
            l7 = Math.min(l5, (long)n4) - Math.max(a8, (long)n5);
            int a2222 = (int)(d3 * (double)l7) + 2 * a52;
            int n12 = Math.min(0, (int)(d3 * (double)(l5 - (long)n4)));
            if (n11 <= 0 || a2222 <= 0) {
                return a13.E();
            }
            BufferedImage bufferedImage = new BufferedImage(n11, a2222, 2);
            Graphics2D a2222 = bufferedImage.createGraphics();
            a2222.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            Graphics2D graphics2D2 = a2222;
            Graphics2D graphics2D3 = a2222;
            graphics2D3.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics2D3.setColor(Colors.TRANSPARENT);
            graphics2D3.fillRect(0, 0, bufferedImage.getWidth(), bufferedImage.getHeight());
            graphics2D2.translate(a4 + b, n12 + a52);
            graphics2D2.setColor(a10);
            graphics2D2.setStroke(new BasicStroke(2.0f));
            a4 = Integer.MAX_VALUE;
            n12 = Integer.MAX_VALUE;
            int a92 = -1;
            int n13 = a112 = 0;
            while (n13 < a2.C.int_j() && a2.C.long_E(a112) <= l4) {
                a12 = (int)((double)(a2.C.long_E(a112) - l6) / d2);
                int n14 = (int)((double)(n4 - a2.C.int_E(a112)) * d3);
                a2222.setColor(a10);
                if (a4 != Integer.MAX_VALUE && n12 != Integer.MAX_VALUE) {
                    a2222.drawLine(a4, n12, a12, n14);
                    if (a92 == 0) {
                        Graphics2D graphics2D4 = a2222;
                        a2222.setColor(color);
                        graphics2D4.fillOval(a4 - 3, n12 - 3, 6, 6);
                        graphics2D4.setColor(a10);
                    }
                }
                a4 = a12;
                n12 = n14;
                a92 = a2.C.j(a112);
                if (a92 > 0) {
                    int n15 = n2 = (int)(14.0 / (double)n6 * (double)a92) + 8;
                    a2222.fillOval(a12 - n2 / 2, n14 - n2 / 2, n15, n15);
                } else if (a92 == 0) {
                    a2222.fillOval(a12 - 4, n14 - 4, 8, 8);
                }
                n13 = ++a112;
            }
            a12 = (int)((double)(n4 - a2.C.int_E(0)) * d3);
            Graphics2D graphics2D5 = a2222;
            Graphics2D graphics2D6 = a2222;
            graphics2D6.setColor(a10);
            graphics2D6.fillOval(-6, a12 - 6, 12, 12);
            graphics2D5.setColor(color);
            graphics2D5.fillOval(-4, a12 - 4, 8, 8);
            int a112 = (int)((double)(a2.C.long_E(a72) - l6) / d2);
            Oe oe3 = a2;
            a12 = (int)((double)(n4 - oe3.C.int_E(a72)) * d3);
            if (oe3.C.j(a72) == -1) {
                Graphics2D graphics2D7 = a2222;
                graphics2D = graphics2D7;
                Graphics2D graphics2D8 = a2222;
                graphics2D8.setColor(a10);
                graphics2D8.fillOval(a112 - 6, a12 - 6, 12, 12);
                graphics2D7.setColor(color);
                graphics2D7.fillOval(a112 - 4, a12 - 4, 8, 8);
            } else {
                int n16 = (int)((double)(l4 - l6) / d2);
                Graphics2D graphics2D9 = a2222;
                graphics2D9.setColor(a10);
                int n17 = a12;
                graphics2D9.drawLine(a112, n17, n16, n17);
                a112 = n16;
                n16 = (int)((double)n16 + d3);
                int n18 = a12;
                if (a2.M) {
                    n2 = n18 + (int)d3;
                    Graphics2D graphics2D10 = a2222;
                    graphics2D = graphics2D10;
                    Graphics2D graphics2D11 = a2222;
                    Graphics2D graphics2D12 = a2222;
                    graphics2D12.drawLine(a112, a12, n16, n2);
                    graphics2D12.setColor(he_1.D);
                    graphics2D11.fillRect(n16, n2, a32.j() + 15, a32.E());
                    graphics2D11.setColor(a10);
                    graphics2D10.drawRect(n16, n2, a32.j() + 15, a32.E());
                    a32.a(n16, n2, a2222);
                } else {
                    n2 = n18 - (int)d3;
                    Graphics2D graphics2D13 = a2222;
                    graphics2D = graphics2D13;
                    Graphics2D graphics2D14 = a2222;
                    Graphics2D graphics2D15 = a2222;
                    graphics2D15.drawLine(a112, a12, n16, n2);
                    graphics2D15.setColor(he_1.D);
                    graphics2D14.fillRect(n16, n2 - a32.E(), a32.j() + 15, a32.E());
                    graphics2D14.setColor(a10);
                    graphics2D13.drawRect(n16, n2 - a32.E(), a32.j() + 15, a32.E());
                    a32.a(n16, n2 - a32.E(), a2222);
                }
            }
            graphics2D.dispose();
            ScreenSpaceCanvas.RelativePixelHorizontalCoordinate relativePixelHorizontalCoordinate = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_DATA_ZERO, Math.max(l6, a6)), -b);
            ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)new ScreenSpaceCanvas.RelativeDataVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_DATA_ZERO, (double)((int)Math.max(a8, (long)n5))), -a52);
            return Triple.of((Object)relativePixelHorizontalCoordinate, (Object)relativePixelVerticalCoordinate, (Object)bufferedImage);
        }
    }

    public ab_1(boolean a2) {
        ab_1 a3;
        a3.c = a2;
    }

    public Triple<ScreenSpaceCanvas.HorizontalCoordinate, ScreenSpaceCanvas.VerticalCoordinate, BufferedImage> E() {
        ScreenSpaceCanvas.RelativeDataHorizontalCoordinate relativeDataHorizontalCoordinate = new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_DATA_ZERO, 0L);
        ScreenSpaceCanvas.RelativeDataVerticalCoordinate relativeDataVerticalCoordinate = new ScreenSpaceCanvas.RelativeDataVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_DATA_ZERO, 0.0);
        return Triple.of((Object)relativeDataHorizontalCoordinate, (Object)relativeDataVerticalCoordinate, (Object)new BufferedImage(1, 1, 2));
    }
}

