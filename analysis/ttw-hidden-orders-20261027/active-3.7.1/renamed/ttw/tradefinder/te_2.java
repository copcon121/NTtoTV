/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Insets;
import java.awt.Paint;
import java.awt.Rectangle;
import java.awt.geom.Path2D;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.border.AbstractBorder;
import javax.swing.border.Border;
import ttw.tradefinder.Ff;
import ttw.tradefinder.nf_1;
import ttw.tradefinder.sf_0;

/*
 * Renamed from ttw.tradefinder.Te
 */
public class te_2
extends AbstractBorder {
    private static final int D = 10;
    private static final int A = 25;
    public static final long C = 7481250625475798376L;
    private final JLabel M;
    private final nf_1 b;
    private String c;

    private static /* synthetic */ Insets E(Border a2, Component a3, Insets a4) {
        Border border = a2;
        if (a2 instanceof AbstractBorder) {
            a2 = (AbstractBorder)border;
            a4 = ((AbstractBorder)a2).getBorderInsets(a3, a4);
            return a4;
        }
        a2 = border.getBorderInsets(a3);
        Insets insets = a4;
        Object object = a2;
        Object object2 = a2;
        insets.set(((Insets)object).top, ((Insets)object).left, ((Insets)object2).bottom, ((Insets)object2).right);
        return insets;
    }

    @Override
    public void paintBorder(Component a2, Graphics a3, int a4, int a5, int a6, int a7) {
        te_2 a8;
        if (a8.c != null && !a8.c.isEmpty()) {
            te_2 te_22 = a8;
            JLabel jLabel = te_22.javax_swing_JLabel_E(a2);
            Dimension dimension = jLabel.getPreferredSize();
            Object object = te_2.E(te_22.b, a2, new Insets(0, 0, 0, 0));
            int n2 = dimension.height;
            Insets insets = object;
            insets.top = insets.top / 2 - n2 / 2;
            int n3 = a5 + ((Insets)object).top;
            insets.left += 25;
            insets.right += 25;
            int n4 = a6 - ((Insets)object).left - ((Insets)object).right;
            if (n4 > dimension.width) {
                n4 = dimension.width;
            }
            int n5 = a4 + ((Insets)object).left;
            object = a3.create();
            if (object instanceof Graphics2D) {
                Graphics2D graphics2D = (Graphics2D)object;
                Path2D.Float float_ = new Path2D.Float();
                int n6 = a5;
                float_.append(new Rectangle(a4, n6, a6, n3 - n6), false);
                Path2D.Float float_2 = float_;
                int n7 = a4;
                float_2.append(new Rectangle(n7, n3, n5 - n7 - 10, n2), false);
                float_2.append(new Rectangle(n5 + n4 + 10, n3, a4 - n5 + a6 - n4 - 10, n2), false);
                float_2.append(new Rectangle(a4, n3 + n2, a6, a5 - n3 + a7 - n2), false);
                graphics2D.clip(float_2);
            }
            a8.b.paintBorder(a2, (Graphics)object, a4, a5, a6, a7);
            ((Graphics)object).dispose();
            Graphics graphics = a3;
            graphics.translate(n5, n3);
            jLabel.setSize(n4, n2);
            jLabel.paint(graphics);
            graphics.translate(-n5, -n3);
            return;
        }
        a8.b.paintBorder(a2, a3, a4, a5, a6, a7);
    }

    public void E(String a2) {
        a.c = a2;
    }

    public Dimension java_awt_Dimension_E(Component a2) {
        Cloneable cloneable;
        te_2 a3;
        te_2 te_22 = a3;
        Insets insets = cloneable = te_22.getBorderInsets((Component)a2);
        Insets insets2 = cloneable;
        cloneable = new Dimension(insets.right + insets.left, insets2.top + insets2.bottom);
        if (te_22.c != null && !a3.c.isEmpty()) {
            a2 = a3.javax_swing_JLabel_E((Component)a2);
            a2 = ((JComponent)a2).getPreferredSize();
            ((Dimension)cloneable).width += ((Dimension)a2).width;
        }
        return cloneable;
    }

    public te_2(String a2, Paint a3, boolean a4) {
        te_2 a5;
        a5.c = a2;
        a5.b = new nf_1(a3, a4);
        a5.M = new JLabel();
        a5.M.setOpaque(false);
    }

    @Override
    public Component.BaselineResizeBehavior getBaselineResizeBehavior(Component a2) {
        te_2 a3;
        super.getBaselineResizeBehavior(a2);
        return Component.BaselineResizeBehavior.CONSTANT_ASCENT;
    }

    @Override
    public int getBaseline(Component a2, int a2222, int a32) {
        te_2 a4;
        if (a2 == null) {
            throw new NullPointerException(Ff.E("9W\u0007VTQ\u0001R\u0004N\r\u0002\u001aM\u001a\u000f\u001aW\u0018NTA\u001bO\u0004M\u001aG\u001aV"));
        }
        if (a2222 < 0) {
            throw new IllegalArgumentException(sf_0.E("!\r\u0012\u0010\u001eD\u001b\u0011\u0005\u0010V\u0006\u0013DHYVT"));
        }
        if (a32 < 0) {
            throw new IllegalArgumentException(Ff.E("j\u0011K\u0013J\u0000\u0002\u0019W\u0007VT@\u0011\u0002J\u001fT\u0012"));
        }
        if (a4.c != null && !a4.c.isEmpty()) {
            te_2 te_22 = a4;
            JLabel a2222 = te_22.javax_swing_JLabel_E((Component)a2);
            Dimension a32 = a2222.getPreferredSize();
            a2 = te_2.E(te_22.b, a2, new Insets(0, 0, 0, 0));
            Dimension dimension = a32;
            int a2222 = a2222.getBaseline(dimension.width, dimension.height);
            ((Insets)a2).top = (((Insets)a2).top - a32.height) / 2;
            return a2222 + ((Insets)a2).top;
        }
        return -1;
    }

    public void E(boolean a2) {
        te_2 a3;
        a3.b.E(a2);
    }

    @Override
    public Insets getBorderInsets(Component a2, Insets a3) {
        te_2 a4;
        te_2 te_22 = a4;
        a3 = te_2.E(te_22.b, a2, a3);
        if (te_22.c != null && !a4.c.isEmpty()) {
            a2 = a4.javax_swing_JLabel_E((Component)a2);
            a2 = ((JComponent)a2).getPreferredSize();
            if (a3.top < ((Dimension)a2).height) {
                a3.top = ((Dimension)a2).height;
            }
            Insets insets = a3;
            insets.top += 10;
            insets.left += 10;
            insets.right += 10;
            insets.bottom += 10;
        }
        return a3;
    }

    private /* synthetic */ JLabel javax_swing_JLabel_E(Component a2) {
        te_2 a3;
        te_2 te_22 = a3;
        te_2 te_23 = a3;
        te_22.M.setText(te_23.c);
        te_22.M.setFont(a2.getFont());
        te_23.M.setForeground(a2.getForeground());
        te_22.M.setComponentOrientation(a2.getComponentOrientation());
        te_22.M.setEnabled(a2.isEnabled());
        return te_22.M;
    }
}

