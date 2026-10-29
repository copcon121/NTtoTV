/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.BasicStroke;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Insets;
import java.awt.Paint;
import java.awt.RenderingHints;
import java.awt.Stroke;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import javax.swing.border.AbstractBorder;
import ttw.tradefinder.ba_2;
import ttw.tradefinder.ed_2;
import ttw.tradefinder.me_1;

/*
 * Renamed from ttw.tradefinder.nF
 */
public class nf_1
extends AbstractBorder {
    private static final BufferedImage j;
    private static int a;
    private static int h;
    private Paint H;
    private Stroke D;
    private static int A;
    private boolean C;
    private static final BufferedImage M;
    public static final long b = 7481250625475698376L;
    private boolean c;

    @Override
    public Insets getBorderInsets(Component a2, Insets a3) {
        nf_1 a4;
        if (a3 == null) {
            Insets insets;
            if (a4.C) {
                int n2 = a;
                insets = new Insets(a + 5, a - 3, n2, n2 - 3);
                a3 = insets;
                return insets;
            }
            int n3 = a;
            int n4 = a;
            insets = new Insets(n3, n3 - 3, n4, n4 - 3);
            a3 = insets;
            return insets;
        }
        Insets insets = a3;
        if (a4.C) {
            insets.left = a - 3;
            a3.right = a - 3;
            a3.bottom = a;
            a3.top = a + 5;
            return a3;
        }
        insets.left = insets.right = a - 3;
        Insets insets2 = a3;
        insets2.bottom = insets2.top = a;
        return a3;
    }

    static {
        h = 5;
        A = 1;
        a = 10;
        j = nf_1.E("images/arrowdown.png");
        M = nf_1.E("images/arrowright.png");
    }

    private static /* synthetic */ BufferedImage E(String a2) {
        try {
            return ImageIO.read(ba_2.class.getClassLoader().getResourceAsStream(a2));
        }
        catch (Exception exception) {
            return new BufferedImage(1, 1, 2);
        }
    }

    public void E(boolean a2) {
        a.c = a2;
    }

    public nf_1(Paint a2, boolean a3) {
        nf_1 a4;
        nf_1 nf_12 = a4;
        nf_1 nf_13 = a4;
        a4.D = new BasicStroke(A);
        nf_13.C = false;
        nf_13.c = false;
        nf_12.H = a2;
        nf_12.C = a3;
    }

    /*
     * Unable to fully structure code
     */
    @Override
    public void paintBorder(Component a, Graphics a, int a, int a, int a, int a) {
        a = (Graphics2D)a;
        var7_8 = a.getPaint();
        v0 = a;
        var8_9 = v0.getStroke();
        var9_10 = v0.getRenderingHint(RenderingHints.KEY_ANTIALIASING);
        try {
            a.setPaint(a.H != null ? a.H : a.getForeground());
            v1 = a;
            a.setStroke(a.D);
            v1.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            v1.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            v2 = nf_1.a;
            v1.drawRoundRect(a + 1, a + nf_1.h, a - 2 * nf_1.A - 1, a - 2 * nf_1.A - nf_1.h, v2, v2);
            if (!a.C) ** GOTO lbl26
            v3 = a;
            v3.setColor(a.getBackground());
            v3.fillRect(a, a, 30, 25);
            v4 = a;
            if (a.c) {
                v4.drawImage(nf_1.M, a, a, 18, 18, null);
                v5 = a;
            } else {
                v4.drawImage(nf_1.j, a, a, 18, 18, null);
lbl26:
                // 2 sources

                v5 = a;
            }
            v5.setPaint(var7_8);
            v6 = a;
            v6.setStroke(var8_9);
            v6.setRenderingHint(RenderingHints.KEY_ANTIALIASING, var9_10);
            return;
        }
        catch (Throwable a) {
            v7 = a;
            v7.setPaint(var7_8);
            v7.setStroke(var8_9);
            v7.setRenderingHint(RenderingHints.KEY_ANTIALIASING, var9_10);
            throw a;
        }
    }
}

