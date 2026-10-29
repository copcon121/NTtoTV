/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import java.awt.Dimension;
import java.awt.Insets;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.Serializable;
import javax.imageio.ImageIO;
import javax.swing.AbstractButton;
import javax.swing.ButtonGroup;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JRadioButton;
import ttw.tradefinder.ae_1;
import ttw.tradefinder.ba_2;
import ttw.tradefinder.be_1;
import ttw.tradefinder.dd_2;
import ttw.tradefinder.ee;
import ttw.tradefinder.ie_2;
import ttw.tradefinder.ig_0;
import ttw.tradefinder.ja_1;
import ttw.tradefinder.kg_0;
import ttw.tradefinder.oe_0;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.se_0;
import ttw.tradefinder.te_1;
import ttw.tradefinder.ud_2;
import ttw.tradefinder.vf_2;
import ttw.tradefinder.ye_2;
import ttw.tradefinder.yf_1;

/*
 * Renamed from ttw.tradefinder.OF
 * Duplicate member names - consider using --renamedupmembers true
 */
public class of_0
extends sc_1 {
    public static final long C = 77147639832545L;
    private final ja_1 a;
    private final JRadioButton h;
    private final JRadioButton H;
    private final JRadioButton D;
    private final JRadioButton A;
    private final JRadioButton C;
    private static final BufferedImage M = of_0.E("images/alert.png");
    private final JLabel b;
    private final JLabel c;

    private /* synthetic */ void j(JRadioButton a2, String a3) {
        int n2;
        of_0 a4;
        if (a4.a.E() == rd_2.H) {
            a4.a.E(rd_2.C);
        }
        String string = ee.E(a4.a.E());
        String[] stringArray = ee.E(rd_2.H, true).toArray(new String[0]);
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
        jComboBox2.addActionListener(new yf_1(a4, jComboBox));
        a4.E((Component)a2, (Component)new JLabel(a3, 2), jComboBox);
    }

    private /* synthetic */ void E(JRadioButton a2, String a3) {
        of_0 a4;
        a3 = new JLabel((String)a3, 2);
        Serializable serializable = new File(a4.a.a());
        if (serializable.exists()) {
            ((JLabel)a3).setText("Ask - " + serializable.getName());
            ((JComponent)a3).setToolTipText(serializable.getAbsolutePath());
        }
        serializable = new JButton("Select");
        ((AbstractButton)serializable).addActionListener(new ie_2(a4, (JButton)serializable, (JLabel)a3));
        a4.E((Component)a2, (Component)a3, (Component)serializable);
    }

    private /* synthetic */ void l() {
        of_0 a2;
        JCheckBox jCheckBox = new JCheckBox("Add price to Advanced/Basic sounds");
        jCheckBox.setSelected(a2.a.E());
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new ig_0(a2, jCheckBox));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void H() {
        of_0 a2;
        of_0 of_02 = a2;
        of_02.b.setText("Advanced - \"" + of_02.a.d() + "\"");
        of_0 of_03 = a2;
        of_03.c.setText("Basic - \"" + of_03.a.j() + "\"");
    }

    public of_0(String a2, String a3, ja_1 a4, boolean a5, boolean a6) {
        super((String)a2, a3 + " Settings");
        of_0 of_02;
        of_0 a7;
        a7.a = a4;
        if (!a6) {
            a7.f(new JLabel("Sound alerts are globally disabled", new ImageIcon(M), 2));
        }
        of_0 of_03 = a7;
        of_03.A = new JRadioButton();
        of_03.D = new JRadioButton();
        of_03.C = new JRadioButton();
        of_03.H = new JRadioButton();
        of_03.h = new JRadioButton();
        of_03.A.setMargin(new Insets(0, 0, 0, 0));
        of_03.D.setMargin(new Insets(0, 0, 0, 0));
        of_03.C.setMargin(new Insets(0, 0, 0, 0));
        of_03.H.setMargin(new Insets(0, 0, 0, 0));
        of_03.h.setMargin(new Insets(0, 0, 0, 0));
        a2 = new ButtonGroup();
        ((ButtonGroup)a2).add(a7.A);
        Object object = a2;
        of_0 of_04 = a7;
        ((ButtonGroup)a2).add(a7.D);
        ((ButtonGroup)a2).add(of_04.C);
        ((ButtonGroup)object).add(of_04.H);
        ((ButtonGroup)object).add(a7.h);
        of_03.b = new JLabel("", 2);
        of_03.c = new JLabel("", 2);
        of_03.H();
        of_03.j(of_03.A, "Predefined");
        of_03.E(of_03.D, "Custom Ask");
        of_03.j("Custom Bid");
        of_03.d((Component)of_03.C, a7.b);
        of_0 of_05 = a7;
        of_05.d((Component)of_05.H, a7.c);
        of_0 of_06 = a7;
        of_06.d((Component)of_06.h, new JLabel("Disabled", 2));
        of_0 of_07 = a7;
        if (a5) {
            of_07.l();
            of_02 = a7;
        } else {
            of_07.a.E(false);
            of_02 = a7;
        }
        of_02.d();
        of_0 of_08 = a7;
        of_08.A();
        of_08.A.addItemListener(new kg_0(a7));
        of_08.D.addItemListener(new dd_2(a7));
        of_08.C.addItemListener(new ye_2(a7));
        of_08.H.addItemListener(new ud_2(a7));
        of_08.h.addItemListener(new be_1(a7));
        a2 = of_08.getLayout().preferredLayoutSize(a7);
        super.setPreferredSize(new Dimension(Math.max(((Dimension)a2).width, 500), ((Dimension)a2).height));
    }

    private /* synthetic */ void j(String a2) {
        of_0 a3;
        a2 = new JLabel((String)a2, 2);
        Serializable serializable = new File(a3.a.E());
        if (serializable.exists()) {
            ((JLabel)a2).setText("Bid - " + serializable.getName());
            ((JComponent)a2).setToolTipText(serializable.getAbsolutePath());
        }
        serializable = new JButton("Select");
        ((AbstractButton)serializable).addActionListener(new vf_2(a3, (JButton)serializable, (JLabel)a2));
        a3.E((Component)a2, (Component)serializable);
    }

    private /* synthetic */ void A() {
        of_0 a2;
        te_1 te_12 = a2.a.E();
        if (te_12 == te_1.b) {
            a2.A.setSelected(true);
            return;
        }
        if (te_12 == te_1.D) {
            a2.D.setSelected(true);
            return;
        }
        if (te_12 == te_1.c) {
            a2.C.setSelected(true);
            return;
        }
        if (te_12 == te_1.M) {
            a2.H.setSelected(true);
            return;
        }
        a2.h.setSelected(true);
    }

    private static /* synthetic */ BufferedImage E(String a2) {
        try {
            return ImageIO.read(ba_2.class.getClassLoader().getResourceAsStream(a2));
        }
        catch (Exception exception) {
            return new BufferedImage(1, 1, 2);
        }
    }

    private /* synthetic */ void d() {
        of_0 a2;
        JButton jButton = new JButton("Play Sound");
        jButton.addActionListener(new oe_0(a2));
        a2.f(jButton);
    }
}

