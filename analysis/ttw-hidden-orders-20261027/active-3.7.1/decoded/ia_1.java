/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Image;
import java.awt.image.BufferedImage;
import javax.swing.JPanel;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.da_1;
import ttw.tradefinder.hc_0;
import ttw.tradefinder.s;
import ttw.tradefinder.xa_1;

/*
 * Renamed from ttw.tradefinder.iA
 */
public class ia_1
extends JPanel {
    private s A;
    private final cc_0 C;
    public static final long M = 76147634812335L;
    private static final int b = 150;
    private static final int c = 250;

    public ia_1(s a2, cc_0 a3) {
        ia_1 a4;
        ia_1 ia_12 = a4;
        a4.A = a2;
        ia_12.C = a3;
        a4.setPreferredSize(new Dimension(250, 150));
        ia_12.setMinimumSize(new Dimension(250, 150));
        ia_12.setMaximumSize(new Dimension(250, 150));
    }

    @Override
    public void paint(Graphics a22) {
        ia_1 a3;
        Graphics graphics = a22;
        graphics.setColor(a3.getBackground());
        graphics.fillRect(0, 0, a3.getWidth(), a3.getHeight());
        Object object = a3.A.E() == xa_1.A ? xa_1.M : a3.A.E();
        object = new da_1(a3.A.E(), (xa_1)((Object)object), a3.A.E(), a3.A.E(), a3.A.E(), a3.A.E(), a3.A.E(), a3.A.j(), a3.A.a());
        object = hc_0.E((da_1)object, a3.C);
        ia_1 ia_12 = a3;
        int a22 = (ia_12.getWidth() - ((BufferedImage)object).getWidth()) / 2;
        int n2 = (ia_12.getHeight() - ((BufferedImage)object).getHeight()) / 2;
        a22.drawImage((Image)object, a22, n2, null);
    }
}

