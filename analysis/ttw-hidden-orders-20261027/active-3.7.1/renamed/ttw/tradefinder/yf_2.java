/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import javax.swing.AbstractButton;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import ttw.tradefinder.NF;
import ttw.tradefinder.ba_2;
import ttw.tradefinder.ee;
import ttw.tradefinder.fg_0;
import ttw.tradefinder.gc_1;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.ja_1;
import ttw.tradefinder.od_2;
import ttw.tradefinder.qE;
import ttw.tradefinder.q_0;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.re_2;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.se_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.ye_1;

/*
 * Renamed from ttw.tradefinder.Yf
 */
public class yf_2 {
    private static BufferedImage b;
    private static BufferedImage c;

    static {
        c = yf_2.E(gc_1.E("\u000b_\u0003U\u0007AMB\u000eS\u001bm\u0005@\u0007W\f\u001c\u0012\\\u0005"));
        b = yf_2.E(fg_0.E("\u0019{\u0011q\u0015e_f\u001cw\tI\u0012z\u0005s^f\u001eq"));
    }

    private static /* synthetic */ BufferedImage E(String a2) {
        try {
            return ImageIO.read(ba_2.class.getClassLoader().getResourceAsStream(a2));
        }
        catch (Exception exception) {
            return new BufferedImage(1, 1, 2);
        }
    }

    public yf_2() {
        yf_2 a2;
    }

    public static void E(String a2, sc_1 a3, gf_2 a4, q_0 a5) {
        a4 = new NF((gf_2)a4, a5);
        JButton jButton = new JButton(fg_0.E("5r\u0019b"));
        jButton.addActionListener(new od_2(jButton, (String)a2, (ja_1)a4, a5));
        a2 = new JButton(new ImageIcon(c));
        ((AbstractButton)a2).setRolloverIcon(new ImageIcon(b));
        Object object = a2;
        ((AbstractButton)object).setContentAreaFilled(false);
        ((AbstractButton)object).addActionListener(new se_2(a5));
        if (a5.boolean_E()) {
            sc_1 sc_12 = a3;
            sc_12.void_E(sc_12.a((Component)new JLabel(gc_1.E("#^\u0007@\u0016\u00121]\u0017\\\u0006")), (Component)a2, jButton));
            return;
        }
        sc_1 sc_13 = a3;
        sc_13.void_E(sc_13.j(new JLabel(fg_0.E("W\u001cs\u0002bPE\u001fc\u001er")), (Component)a2, jButton, qE.E(ye_1.c, true)));
    }

    public static void E(sc_1 a2, gf_2 a3, q_0 a4) {
        int n2;
        if (a3.A != te_1.b) {
            gf_2 gf_22 = a3;
            gf_22.A = te_1.b;
            gf_22.C = rd_2.H;
            a4.void_E();
        }
        String string = ee.E(a3.C);
        String[] stringArray = ee.E(rd_2.H).toArray(new String[0]);
        JComboBox<String> jComboBox = new JComboBox<String>(stringArray);
        int n3 = stringArray.length;
        int n4 = n2 = 0;
        while (n4 < n3) {
            if (stringArray[n2].equals(string)) {
                jComboBox.setSelectedItem(string);
            }
            n4 = ++n2;
        }
        JComboBox<String> jComboBox2 = jComboBox;
        jComboBox2.setEditable(false);
        jComboBox2.addActionListener(new re_2(jComboBox, a3, a4));
        if (a4.boolean_E()) {
            sc_1 sc_12 = a2;
            sc_12.void_E(sc_12.a(new JLabel(fg_0.E("W\u001cs\u0002bPE\u001fc\u001er")), jComboBox));
            return;
        }
        sc_1 sc_13 = a2;
        sc_13.void_E(sc_13.j(new JLabel(gc_1.E("#^\u0007@\u0016\u00121]\u0017\\\u0006")), jComboBox, qE.E(ye_1.c, true)));
    }
}

