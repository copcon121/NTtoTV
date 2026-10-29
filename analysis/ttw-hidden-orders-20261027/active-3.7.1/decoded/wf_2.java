/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.colors.Colors
 */
package ttw.tradefinder;

import java.awt.Component;
import java.awt.image.BufferedImage;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import javax.imageio.ImageIO;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;
import ttw.tradefinder.K;
import ttw.tradefinder.Pc;
import ttw.tradefinder.ba_2;
import ttw.tradefinder.be_2;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.de_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ed_2;
import ttw.tradefinder.ei;
import ttw.tradefinder.f_0;
import ttw.tradefinder.gb_1;
import ttw.tradefinder.hd_1;
import ttw.tradefinder.hd_2;
import ttw.tradefinder.jA;
import ttw.tradefinder.kd_2;
import ttw.tradefinder.le_2;
import ttw.tradefinder.ne_1;
import ttw.tradefinder.nf_2;
import ttw.tradefinder.of_2;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.vE;
import ttw.tradefinder.xf_1;
import ttw.tradefinder.yd_2;
import ttw.tradefinder.ze_2;
import velox.gui.colors.Colors;

/*
 * Renamed from ttw.tradefinder.wF
 */
public class wf_2 {
    private final K a;
    private static final String h;
    private final K H;
    private final String D;
    private final ed_2 A;
    private BufferedImage C;
    private BufferedImage M;
    private static byte[] b;
    private static final String c;

    public void E() {
        wf_2 a2;
        wf_2 wf_22 = a2;
        wf_22.H.E();
        wf_22.a.E();
    }

    public boolean E(dd_1 a2) {
        wf_2 a3;
        return a3.H.E(a2);
    }

    static {
        c = "^[0-9]{5,15}$";
        h = "^[0-9]{5,15}:[a-zA-Z0-9_-]{30,40}$";
        b = wf_2.E();
    }

    private /* synthetic */ void a(sc_1 a2, df_0<jA, ei> a3) {
        wf_2 a4;
        JButton jButton = new JButton(new ImageIcon(a4.C));
        JPasswordField jPasswordField = new JPasswordField(0);
        jPasswordField.putClientProperty("JPasswordField.cutCopyAllowed", Boolean.TRUE);
        JPasswordField jPasswordField2 = jPasswordField;
        JPasswordField jPasswordField3 = jPasswordField;
        ne_1.E(jPasswordField3);
        jPasswordField3.setEchoChar('*');
        jPasswordField2.setHorizontalAlignment(0);
        jPasswordField2.setText(a4.E(((jA)a3.M).C));
        sc_1 sc_12 = a2;
        JPasswordField jPasswordField4 = jPasswordField;
        jPasswordField4.setFont(jPasswordField4.getFont().deriveFont(12.0f));
        jPasswordField4.addFocusListener(new kd_2(a4, jPasswordField, jButton, a3));
        jPasswordField4.addKeyListener(new of_2(a4, jPasswordField, a3));
        JButton jButton2 = jButton;
        jButton2.setSize(25, 25);
        jButton.setBackground(Colors.TRANSPARENT);
        jButton2.addActionListener(new yd_2(a4, jPasswordField, jButton));
        sc_12.E(sc_12.a(new JLabel("Telegram Bot Token")));
        sc_12.E(sc_12.a((Component)jPasswordField, (Component)jButton));
    }

    public Collection<? extends sc_1> E(df_0<jA, ei> a2, ze_2 a3, f_0 a4) {
        wf_2 a5;
        if (!a5.H.E(a3.j)) {
            return Collections.emptyList();
        }
        a4 = new sc_1(a3.M, a5.D, 1000, false, xf_1.M, (f_0)a4);
        wf_2 wf_22 = a5;
        Object object = a4;
        a5.a((sc_1)object, a2);
        wf_22.E((sc_1)object, a2);
        wf_22.j((sc_1)a4, a2);
        if (wf_22.a.j()) {
            a5.E(a3.M, (sc_1)a4, a2);
        }
        return Arrays.asList(a4);
    }

    public String j(String a2) {
        if (b.length == 0) {
            return a2;
        }
        return hd_1.E(a2, b);
    }

    private /* synthetic */ void E(String a2, sc_1 a3, df_0<jA, ei> a4) {
        wf_2 a5;
        JButton jButton = new JButton("Send All");
        jButton.addActionListener(new le_2(a5, a2, a4));
        sc_1 sc_12 = a3;
        sc_12.E(sc_12.j(new JLabel("Development Test"), (Component)jButton));
    }

    private static /* synthetic */ byte[] E() {
        String string = de_1.E();
        if (string.isEmpty()) {
            return new byte[0];
        }
        return hd_1.E(string);
    }

    public String E(String a2) {
        if (b.length == 0) {
            return a2;
        }
        return hd_1.j(a2, b);
    }

    private /* synthetic */ void j(sc_1 a2, df_0<jA, ei> a3) {
        wf_2 a4;
        JButton jButton = new JButton("Send Message");
        jButton.addActionListener(new hd_2(a4, a3));
        a2.j(new JLabel("Communication Test"), (Component)jButton);
    }

    public wf_2(f_0 a2, ed_2 a3, r_0 a4) {
        wf_2 a5;
        wf_2 wf_22 = a5;
        a5.A = a3;
        wf_22.D = a4.E();
        wf_22.H = a4.E(a2.E()).E(null);
        wf_22.a = new Pc("AlertDevLicense", Collections.emptyList(), a2.E()).E(null);
        try {
            a5.C = ImageIO.read(ba_2.class.getClassLoader().getResourceAsStream("images/view.png"));
            a5.M = ImageIO.read(ba_2.class.getClassLoader().getResourceAsStream("images/hide.png"));
            return;
        }
        catch (Exception exception) {
            wf_2 wf_23 = a5;
            wf_23.C = new BufferedImage(1, 1, 2);
            wf_23.M = new BufferedImage(1, 1, 2);
            return;
        }
    }

    private /* synthetic */ void E(sc_1 a2, df_0<jA, ei> a3) {
        wf_2 a4;
        JTextField jTextField = new JTextField(10);
        jTextField.putClientProperty("JTextField.cutCopyAllowed", Boolean.TRUE);
        JTextField jTextField2 = jTextField;
        ne_1.E(jTextField);
        jTextField2.setHorizontalAlignment(0);
        jTextField2.setText(((jA)a3.M).M);
        sc_1 sc_12 = a2;
        JTextField jTextField3 = jTextField;
        jTextField3.setFont(jTextField3.getFont().deriveFont(12.0f));
        jTextField3.addFocusListener(new be_2(a4, jTextField, a3, a2));
        jTextField3.addKeyListener(new nf_2(a4, jTextField, a3, a2));
        sc_12.E(sc_12.j(new JLabel("Telegram User Id"), (Component)jTextField));
    }
}

