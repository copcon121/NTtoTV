/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Graphics2D;
import javax.swing.JPanel;
import ttw.tradefinder.n;

/*
 * Renamed from ttw.tradefinder.Ac
 */
public class ac_1
extends JPanel {
    private static final int C = 100;
    private n M;
    public static final long b = 76147634812335L;
    private static final int c = 300;

    public ac_1(n a2) {
        ac_1 a3;
        ac_1 ac_12 = a3;
        ac_1 ac_13 = a3;
        ac_12.M = a2;
        ac_13.setPreferredSize(new Dimension(300, 100));
        ac_12.setMinimumSize(new Dimension(300, 100));
        ac_12.setMaximumSize(new Dimension(300, 100));
    }

    @Override
    public void paint(Graphics a2) {
        ac_1 a3;
        Graphics graphics = a2;
        graphics.setColor(a3.getBackground());
        graphics.fillRect(0, 0, a3.getWidth(), a3.getHeight());
        a3.M.E((Graphics2D)a2, 20, 0, a3.getWidth() - 40, a3.getHeight());
    }
}

