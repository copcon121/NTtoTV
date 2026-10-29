/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Image;
import java.awt.image.BufferedImage;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import ttw.tradefinder.T;
import ttw.tradefinder.ac_2;
import ttw.tradefinder.bb_2;
import ttw.tradefinder.dc_2;
import ttw.tradefinder.ja_0;
import ttw.tradefinder.kc_1;
import ttw.tradefinder.mb_2;
import ttw.tradefinder.pb_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.kb
 */
public class kb_1
extends JPanel
implements T {
    private final dc_2 C;
    private final bb_2 M;
    public static final long b = 73147634812335L;
    private static final int c = 180;

    public kb_1(ze_2 a2, float a3) {
        kb_1 a4;
        kb_1 kb_12 = a4;
        kb_12.M = new bb_2((ze_2)a2, 180);
        kb_12.M.E(a3);
        kb_12.C = new dc_2(kc_1.M, ja_0.b, mb_2.c, 10);
        a2 = kb_12.M.E(a4.C);
        kb_12.setPreferredSize(new Dimension(((BufferedImage)a2).getWidth() + 10, ((BufferedImage)a2).getHeight() + 10));
    }

    @Override
    public void paint(Graphics a2) {
        kb_1 a3;
        Graphics graphics = a2;
        ((Graphics)a2).setColor(a3.getBackground());
        graphics.fillRect(0, 0, a3.getWidth(), a3.getHeight());
        Object object = a2 = a3.M.E(a3.C);
        graphics.drawImage((Image)object, (a3.getWidth() - ((BufferedImage)a2).getWidth()) / 2, (a3.getHeight() - ((BufferedImage)object).getHeight()) / 2, null);
    }

    @Override
    public void E(float a22) {
        kb_1 a3;
        kb_1 kb_12 = a3;
        kb_12.M.E(a22);
        kb_1 kb_13 = a3;
        BufferedImage a22 = kb_12.M.E(kb_13.C);
        kb_13.setPreferredSize(new Dimension(a22.getWidth() + 10, a22.getHeight() + 10));
        SwingUtilities.invokeLater(() -> {
            kb_1 a2;
            a2.repaint();
        });
    }

    @Override
    public void E(pb_2 a2, ac_2 a3) {
        kb_1 a4;
        kb_1 kb_12 = a4;
        kb_12.M.E(a2);
        kb_12.M.E(a3);
        SwingUtilities.invokeLater(() -> {
            kb_1 a2;
            a2.repaint();
        });
    }
}

