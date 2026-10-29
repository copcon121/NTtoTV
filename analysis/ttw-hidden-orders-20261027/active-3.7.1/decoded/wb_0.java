/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.colors.Colors
 */
package ttw.tradefinder;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import ttw.tradefinder.he_1;
import ttw.tradefinder.jc;
import ttw.tradefinder.kd;
import ttw.tradefinder.na_0;
import velox.gui.colors.Colors;

/*
 * Renamed from ttw.tradefinder.Wb
 */
public class wb_0 {
    private static int A;
    private static int C;
    private static int M;
    private static int b;
    private static int c;

    public wb_0() {
        wb_0 a2;
    }

    static {
        C = 4;
        M = 20;
        c = 3;
        A = 1;
        b = 10;
    }

    public static BufferedImage E(na_0 a2, int a3, boolean a4) {
        Graphics2D graphics2D;
        BufferedImage bufferedImage;
        block5: {
            Graphics2D graphics2D2;
            block4: {
                Object object;
                Color color;
                block3: {
                    na_0 na_02 = a2;
                    color = na_02.M;
                    if (!na_02.C) {
                        float[] fArray = Color.RGBtoHSB(color.getRed(), color.getGreen(), color.getBlue(), null);
                        object = fArray;
                        fArray[1] = Math.max(0.2f, Math.min(1.0f, (float)(object[1] - 0.4f)));
                        color = Color.getHSBColor((float)object[0], (float)object[1], (float)object[2]);
                    }
                    if (a3 <= ((jc)(object = new kd(a2.b, color))).a() + b || a3 < 30) {
                        return new BufferedImage(1, 1, 2);
                    }
                    bufferedImage = new BufferedImage(a3, ((jc)object).E() + C, 2);
                    graphics2D2 = bufferedImage.createGraphics();
                    graphics2D2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                    Graphics2D graphics2D3 = graphics2D2;
                    graphics2D3.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                    graphics2D3.setColor(Colors.TRANSPARENT);
                    graphics2D3.fillRect(0, 0, bufferedImage.getWidth(), bufferedImage.getHeight());
                    if (!a4) break block3;
                    Graphics2D graphics2D4 = graphics2D2;
                    graphics2D2.setColor(he_1.D);
                    int n2 = M;
                    graphics2D4.fillRoundRect(bufferedImage.getWidth() - ((jc)object).a() - b, C - M, ((jc)object).a(), ((jc)object).E() + M, n2, n2);
                    graphics2D4.setColor(color);
                    Object object2 = object;
                    ((jc)object2).d(bufferedImage.getWidth() - ((jc)object).a() - b, C, ((jc)object2).a(), ((jc)object).E(), 0, graphics2D2);
                    int n3 = C;
                    graphics2D2.fillRoundRect(0, 0, a3, n3, n3, C);
                    if (a2.C) break block4;
                    Graphics2D graphics2D5 = graphics2D2;
                    graphics2D = graphics2D5;
                    graphics2D5.setStroke(new BasicStroke(A));
                    graphics2D5.drawLine(bufferedImage.getWidth() - ((jc)object).a() + c - b, ((jc)object).E() / 2 + C, bufferedImage.getWidth() - c - b, ((jc)object).E() / 2 + C);
                    break block5;
                }
                Graphics2D graphics2D6 = graphics2D2;
                graphics2D2.setColor(he_1.D);
                int n4 = M;
                graphics2D6.fillRoundRect(bufferedImage.getWidth() - ((jc)object).a() - b, 0, ((jc)object).a(), ((jc)object).E() + M, n4, n4);
                graphics2D6.setColor(color);
                Object object3 = object;
                ((jc)object3).d(bufferedImage.getWidth() - ((jc)object).a() - b, 0, ((jc)object3).a(), ((jc)object).E(), 0, graphics2D2);
                int n5 = C;
                graphics2D2.fillRoundRect(0, bufferedImage.getHeight() - C, a3, n5, n5, C);
                if (!a2.C) {
                    Graphics2D graphics2D7 = graphics2D2;
                    graphics2D7.setStroke(new BasicStroke(A));
                    graphics2D7.drawLine(bufferedImage.getWidth() - ((jc)object).a() + c - b, ((jc)object).E() / 2, bufferedImage.getWidth() - c - b, ((jc)object).E() / 2);
                }
            }
            graphics2D = graphics2D2;
        }
        graphics2D.dispose();
        return bufferedImage;
    }
}

