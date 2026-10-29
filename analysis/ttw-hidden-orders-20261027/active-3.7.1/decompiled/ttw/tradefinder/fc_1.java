/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.colors.Colors
 */
package ttw.tradefinder;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import ttw.tradefinder.he_1;
import ttw.tradefinder.jc;
import ttw.tradefinder.kd;
import velox.gui.colors.Colors;

/*
 * Renamed from ttw.tradefinder.fc
 */
public class fc_1 {
    private static final int b = 20;
    private static final int c = 100;

    public BufferedImage E(String a2, int a32) {
        if (a32 < 100) {
            return new BufferedImage(1, 1, 2);
        }
        a2 = new kd((String)a2, he_1.h);
        BufferedImage a32 = new BufferedImage(a32, 20, 2);
        Graphics2D graphics2D = a32.createGraphics();
        graphics2D.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Graphics2D graphics2D2 = graphics2D;
        Graphics2D graphics2D3 = graphics2D;
        graphics2D.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics2D3.setColor(Colors.TRANSPARENT);
        graphics2D3.fillRect(0, 0, a32.getWidth(), a32.getHeight());
        graphics2D3.setColor(he_1.D);
        graphics2D2.fillRoundRect(0, 0, a32.getWidth(), a32.getHeight(), 5, 5);
        ((jc)a2).d(0, 0, a32.getWidth(), a32.getHeight(), 0, graphics2D);
        graphics2D2.dispose();
        return a32;
    }

    public fc_1() {
        fc_1 a2;
    }
}

