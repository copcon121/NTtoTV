/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.a;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.image.BufferedImage;

public class i {
    public static BufferedImage a(BufferedImage bufferedImage, int n2, int n3) {
        Image image = bufferedImage.getScaledInstance(n2, n3, 4);
        BufferedImage bufferedImage2 = new BufferedImage(n2, n3, 2);
        Graphics2D graphics2D = bufferedImage2.createGraphics();
        graphics2D.drawImage(image, 0, 0, null);
        graphics2D.dispose();
        return bufferedImage2;
    }

    public static BufferedImage a(BufferedImage bufferedImage, Color color) {
        int n2 = bufferedImage.getWidth();
        int n3 = bufferedImage.getHeight();
        BufferedImage bufferedImage2 = new BufferedImage(n2, n3, bufferedImage.getType());
        for (int i2 = 0; i2 < n2; ++i2) {
            for (int i3 = 0; i3 < n3; ++i3) {
                Color color2 = new Color(bufferedImage.getRGB(i2, i3), true);
                if (color2.getAlpha() != 0) {
                    bufferedImage2.setRGB(i2, i3, i.a(color2, color).getRGB());
                    continue;
                }
                bufferedImage2.setRGB(i2, i3, color2.getRGB());
            }
        }
        return bufferedImage2;
    }

    public static Color a(Color color, Color color2) {
        int n2;
        int n3;
        int n4 = color.getRed() + color2.getRed();
        if (n4 > 255) {
            n4 = 255;
        }
        if ((n3 = color.getGreen() + color2.getGreen()) > 255) {
            n3 = 255;
        }
        if ((n2 = color.getBlue() + color2.getBlue()) > 255) {
            n2 = 255;
        }
        return new Color(n4, n3, n2, color2.getAlpha());
    }
}

