/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import java.awt.Dimension;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.LayoutManager;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Consumer;
import javax.imageio.ImageIO;
import javax.swing.BorderFactory;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JRadioButton;
import javax.swing.SwingUtilities;
import ttw.tradefinder.af_0;
import ttw.tradefinder.ba_2;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_2;
import ttw.tradefinder.kd_1;
import ttw.tradefinder.ne_2;
import ttw.tradefinder.qe_2;
import ttw.tradefinder.ue_1;
import ttw.tradefinder.vE;
import ttw.tradefinder.xf_1;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.SC
 */
public class sc_1
extends JPanel {
    private final int g;
    private static final BufferedImage L;
    private TreeMap<Integer, Boolean> l;
    public String m;
    private final af_0 I;
    private final xf_1 f;
    private boolean F;
    private int J;
    private static final int G = 10;
    private static final BufferedImage d;
    private final String i;
    private static final int e = 5;
    private final boolean k;
    private int B;
    private Consumer<String> K;
    private static final int E = -1;
    private TreeMap<Integer, Set<Component>> j;
    private boolean a;
    private static final int h = 10;
    private final String H;
    private boolean D;
    private List<Component> A;
    public static final long C = 7484950625475698376L;
    private static final BufferedImage M;
    private final f_0 b;
    private List<Integer> c;

    static {
        M = sc_1.E(kd_1.E("-\u000b%\u0001!\u0015k\u000f*\u0000+H4\b#"));
        d = sc_1.E(qe_2.E("cbkho|%nfjx{$\u007fdh"));
        L = sc_1.E(kd_1.E("-\u000b%\u0001!\u0015k\u00120\u0011\u001b\n+\u0001+H4\b#"));
    }

    public int a(Component a22, Component a3, vE a4) {
        sc_1 a5;
        if (!a5.A.contains(a22)) {
            a22.setEnabled(a5.D);
        }
        if (!a5.A.contains(a3)) {
            a3.setEnabled(a5.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a5.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        GridBagConstraints gridBagConstraints4 = gridBagConstraints;
        GridBagConstraints gridBagConstraints5 = gridBagConstraints;
        gridBagConstraints.gridwidth = 2;
        gridBagConstraints5.gridx = 2;
        gridBagConstraints5.weightx = 2.0;
        gridBagConstraints4.fill = 2;
        gridBagConstraints4.anchor = 17;
        gridBagConstraints3.insets = new Insets(5, 0, 0, 0);
        int a22 = a5.E(a22, gridBagConstraints, -1);
        gridBagConstraints3.gridx = 5;
        gridBagConstraints2.gridwidth = 1;
        gridBagConstraints2.fill = 0;
        gridBagConstraints2.anchor = 13;
        a5.E(a3, gridBagConstraints, a22);
        if (a4 != null && !a4.E()) {
            a5.E(gridBagConstraints, a4, a22);
        }
        return a22;
    }

    public int f(Component a22, vE a3) {
        sc_1 a4;
        if (!a4.A.contains(a22)) {
            a22.setEnabled(a4.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a4.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 5;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(0, 0, 0, 0);
        gridBagConstraints2.anchor = 17;
        if (a4.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a4.E(a22, gridBagConstraints, -1);
        if (a3 != null && !a3.E()) {
            a4.E(gridBagConstraints, a3, a22);
        }
        return a22;
    }

    public void a() {
        Component component;
        int n2;
        sc_1 a2;
        LayoutManager layoutManager = a2.getLayout();
        if (!(layoutManager instanceof GridBagLayout)) {
            return;
        }
        layoutManager = (GridBagLayout)layoutManager;
        int n3 = -1;
        Component[] componentArray = a2.getComponents();
        int n4 = componentArray.length;
        int n5 = n2 = 0;
        while (n5 < n4) {
            component = componentArray[n2];
            n3 = Math.max(n3, ((GridBagLayout)layoutManager).getConstraints((Component)component).gridy);
            n5 = ++n2;
        }
        if (n3 == -1) {
            return;
        }
        componentArray = a2.getComponents();
        n4 = componentArray.length;
        int n6 = n2 = 0;
        while (n6 < n4) {
            component = componentArray[n2];
            GridBagConstraints gridBagConstraints = ((GridBagLayout)layoutManager).getConstraints(component);
            if (gridBagConstraints.gridy == n3) {
                GridBagConstraints gridBagConstraints2 = gridBagConstraints;
                gridBagConstraints2.weighty = 1.0;
                gridBagConstraints2.anchor = 11;
                ((GridBagLayout)layoutManager).setConstraints(component, gridBagConstraints);
            }
            n6 = ++n2;
        }
    }

    public void j() {
        a.F = true;
    }

    public int a(JLabel a2, Component a3) {
        sc_1 a4;
        return a4.j(a2, a3, new vE());
    }

    public int g(Component a22) {
        sc_1 a3;
        if (!a3.A.contains(a22)) {
            a22.setEnabled(a3.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a3.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 2;
        gridBagConstraints2.gridx = 5;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 10);
        gridBagConstraints2.fill = 2;
        if (a3.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a3.E(a22, gridBagConstraints, -1);
        return a22;
    }

    public String E() {
        sc_1 a2;
        return a2.H;
    }

    public int j(JCheckBox a2, Component a3) {
        sc_1 a4;
        return a4.E(a2, a3, new vE());
    }

    public int f(Component a2) {
        sc_1 a3;
        sc_1 sc_12 = a3;
        return sc_12.E(a2, sc_12.J++);
    }

    public int l(Component a2) {
        sc_1 a3;
        return a3.E(a2, (vE)null);
    }

    public void j(sc_1 a2, sc_1 a3) {
        sc_1 a4;
        a4.E(a2, a3, 0);
    }

    public int H(Component a2) {
        sc_1 a3;
        return a3.H(a2, null);
    }

    public void E(String a2) {
        sc_1 a3;
        a3.m = a2;
        if (a3.K != null) {
            sc_1 sc_12 = a3;
            sc_12.K.accept(sc_12.m);
        }
    }

    private /* synthetic */ void j(int a2) {
        sc_1 a3;
        if (!a3.j.containsKey(a2)) {
            return;
        }
        boolean bl = true;
        if (a3.c.contains(a2) && a3.a) {
            bl = false;
        }
        if (a3.l.containsKey(a2) && !a3.l.get(a2).booleanValue()) {
            bl = false;
        }
        Iterator<Component> iterator = a2 = a3.j.get(a2).iterator();
        while (iterator.hasNext()) {
            a2.next().setVisible(bl);
            iterator = a2;
        }
    }

    private /* synthetic */ boolean E(int a2) {
        int n2;
        sc_1 a3;
        LayoutManager layoutManager = a3.getLayout();
        if (!(layoutManager instanceof GridBagLayout)) {
            return false;
        }
        layoutManager = (GridBagLayout)layoutManager;
        Component[] componentArray = a3.getComponents();
        int n3 = componentArray.length;
        int n4 = n2 = 0;
        while (n4 < n3) {
            Component component = componentArray[n2];
            if (((GridBagLayout)layoutManager).getConstraints((Component)component).gridy == a2) {
                return true;
            }
            n4 = ++n2;
        }
        return false;
    }

    public static sc_1 E(String a2, f_0 a3) {
        a2 = new sc_1((String)a2, null, -1000, false, xf_1.C, af_0.B, a3);
        ((sc_1)a2).d(new JLabel(new ImageIcon(L)));
        return a2;
    }

    public int A(Component a2) {
        sc_1 a3;
        return a3.A(a2, null);
    }

    private /* synthetic */ void E(JPanel a2, Boolean a3) {
        int n2;
        a2.setEnabled(a3);
        Component[] componentArray = a2.getComponents();
        a2 = componentArray;
        a2 = componentArray;
        int n3 = componentArray.length;
        int n4 = n2 = 0;
        while (n4 < n3) {
            sc_1 a4;
            Component component = a2[n2];
            if (!a4.A.contains(component)) {
                if (component instanceof JPanel) {
                    a4.E((JPanel)component, a3);
                }
                component.setEnabled(a3);
            }
            n4 = ++n2;
        }
    }

    public int l(Component a22, vE a3) {
        sc_1 a4;
        if (!a4.A.contains(a22)) {
            a22.setEnabled(a4.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a4.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 5;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.anchor = 13;
        if (a4.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a4.E(a22, gridBagConstraints, -1);
        if (a3 != null && !a3.E()) {
            a4.E(gridBagConstraints, a3, a22);
        }
        return a22;
    }

    public int d(Component a2, Component a3) {
        sc_1 a4;
        return a4.E(a2, a3, (vE)null);
    }

    public int a(Component a2, Component a3, Component a4) {
        sc_1 a5;
        return a5.j(a2, a3, a4, null);
    }

    private /* synthetic */ void E(sc_1 a22, sc_1 a3, int a42) {
        sc_1 a5;
        sc_1 sc_12 = a5;
        a22 = sc_12.E((sc_1)a22);
        LayoutManager layoutManager = sc_12.getLayout();
        if (a22 == null || !(layoutManager instanceof GridBagLayout)) {
            SwingUtilities.invokeLater(() -> {
                sc_1 a3;
                int a22 = a3.f((Component)((Object)new ue_1(a3)));
                if (a3.a() && a3.E() == xf_1.M) {
                    a3.E(a22);
                }
            });
            return;
        }
        layoutManager = (GridBagLayout)layoutManager;
        int a22 = ((GridBagLayout)layoutManager).getConstraints((Component)a22).gridy + a42;
        if (a5.E(a22)) {
            int n2;
            Component[] a42 = a5.getComponents();
            int n3 = a42.length;
            int n4 = n2 = 0;
            while (n4 < n3) {
                Component component = a42[n2];
                GridBagConstraints gridBagConstraints = ((GridBagLayout)layoutManager).getConstraints(component);
                if (gridBagConstraints.gridy >= a22) {
                    ++gridBagConstraints.gridy;
                    ((GridBagLayout)layoutManager).setConstraints(component, gridBagConstraints);
                }
                n4 = ++n2;
            }
        }
        SwingUtilities.invokeLater(() -> {
            sc_1 a4;
            a22 = a4.E((Component)((Object)new ue_1(a3)), a22);
            if (a3.a() && a4.E() == xf_1.M) {
                a4.E(a22);
            }
        });
    }

    public int E() {
        sc_1 a2;
        return a2.g;
    }

    public boolean A() {
        sc_1 a2;
        return a2.c.size() > 0;
    }

    public int j(JLabel a22, Component a3) {
        sc_1 a4;
        if (!a4.A.contains(a22)) {
            a22.setEnabled(a4.D);
        }
        if (!a4.A.contains(a3)) {
            a3.setEnabled(a4.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a4.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 1;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 10);
        gridBagConstraints2.anchor = 17;
        if (a4.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a4.E((Component)a22, gridBagConstraints, -1);
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints.anchor = 13;
        gridBagConstraints3.fill = 2;
        gridBagConstraints3.gridwidth = 2;
        gridBagConstraints.gridx = 5;
        a4.E(a3, gridBagConstraints, a22);
        return a22;
    }

    public int d(Component a2) {
        sc_1 a3;
        return a3.l(a2, null);
    }

    public sc_1(String a2, String a3, int a4, boolean a5, xf_1 a6, f_0 a7) {
        sc_1 a8;
        String string;
        String string2;
        if (a3 == null) {
            string2 = "";
            string = a3;
        } else {
            string2 = a3.replaceAll(kd_1.E("\u0018\u0015o"), "");
            string = a3;
        }
        a8(a2, string2, string, a4, a5, a6, af_0.B, a7);
    }

    public int H(Component a22, vE a3) {
        sc_1 a4;
        if (!a4.A.contains(a22)) {
            a22.setEnabled(a4.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a4.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints3.gridwidth = 5;
        gridBagConstraints3.gridx = 1;
        gridBagConstraints3.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.anchor = 17;
        gridBagConstraints2.fill = 2;
        if (a4.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a4.E(a22, gridBagConstraints, -1);
        if (a3 != null && !a3.E()) {
            a4.E(gridBagConstraints, a3, a22);
        }
        return a22;
    }

    public int a(Component a22, Component a3, Component a4, vE a5) {
        sc_1 a6;
        if (!a6.A.contains(a22)) {
            a22.setEnabled(a6.D);
        }
        if (!a6.A.contains(a3)) {
            a3.setEnabled(a6.D);
        }
        if (!a6.A.contains(a4)) {
            a4.setEnabled(a6.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a6.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        GridBagConstraints gridBagConstraints4 = gridBagConstraints;
        GridBagConstraints gridBagConstraints5 = gridBagConstraints;
        gridBagConstraints5.gridwidth = 1;
        gridBagConstraints5.gridx = 1;
        gridBagConstraints4.weightx = 0.0;
        gridBagConstraints4.anchor = 17;
        gridBagConstraints3.insets = new Insets(5, 0, 0, 0);
        int a22 = a6.E(a22, gridBagConstraints, -1);
        gridBagConstraints3.gridx = 2;
        gridBagConstraints2.gridwidth = 2;
        gridBagConstraints2.weightx = 2.0;
        gridBagConstraints2.fill = 2;
        a6.E(a3, gridBagConstraints, a22);
        GridBagConstraints gridBagConstraints6 = gridBagConstraints;
        GridBagConstraints gridBagConstraints7 = gridBagConstraints;
        gridBagConstraints7.gridx = 5;
        gridBagConstraints7.gridwidth = 1;
        gridBagConstraints6.fill = 0;
        gridBagConstraints6.anchor = 13;
        a6.E(a4, gridBagConstraints, a22);
        if (a5 != null && !a5.E()) {
            a6.E(gridBagConstraints, a5, a22);
        }
        return a22;
    }

    public boolean d() {
        sc_1 a2;
        return a2.a;
    }

    public int A(Component a22, vE a3) {
        sc_1 a4;
        if (!a4.A.contains(a22)) {
            a22.setEnabled(a4.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a4.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 5;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.anchor = 10;
        if (a4.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a4.E(a22, gridBagConstraints, -1);
        if (a3 != null && !a3.E()) {
            a4.E(gridBagConstraints, a3, a22);
        }
        return a22;
    }

    public af_0 E() {
        sc_1 a2;
        return a2.I;
    }

    public void E(boolean a2) {
        int n2;
        sc_1 a3;
        a3.D = a2;
        Component[] componentArray = a3.getComponents();
        Component[] componentArray2 = componentArray;
        componentArray2 = componentArray;
        int n3 = componentArray.length;
        int n4 = n2 = 0;
        while (n4 < n3) {
            Component component = componentArray2[n2];
            if (!a3.A.contains(component)) {
                if (component instanceof JPanel) {
                    a3.E((JPanel)component, a2);
                }
                component.setEnabled(a2);
            }
            n4 = ++n2;
        }
    }

    public int a(Component a22, Component a3) {
        sc_1 a4;
        if (!a4.A.contains(a22)) {
            a22.setEnabled(a4.D);
        }
        if (!a4.A.contains(a3)) {
            a3.setEnabled(a4.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a4.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 5;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.fill = 2;
        if (a4.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a4.E(a22, gridBagConstraints, -1);
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints3.fill = 0;
        gridBagConstraints3.gridwidth = 1;
        gridBagConstraints.gridx = 6;
        a4.E(a3, gridBagConstraints, a22);
        return a22;
    }

    public void j(boolean a2, int a3) {
        sc_1 a4;
        if (!a4.j.containsKey(a3)) {
            return;
        }
        Iterator<Component> iterator = a3 = a4.j.get(a3).iterator();
        while (iterator.hasNext()) {
            a3.next().setEnabled(a2);
            iterator = a3;
        }
    }

    public int d(Component a22, vE a3) {
        sc_1 a4;
        if (!a4.A.contains(a22)) {
            a22.setEnabled(a4.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a4.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints3.gridwidth = 5;
        gridBagConstraints3.gridx = 1;
        gridBagConstraints3.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.anchor = 13;
        gridBagConstraints2.fill = 2;
        if (a4.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a4.E(a22, gridBagConstraints, -1);
        if (a3 != null && !a3.E()) {
            a4.E(gridBagConstraints, a3, a22);
        }
        return a22;
    }

    @Override
    public Dimension getPreferredSize() {
        sc_1 a2;
        if (a2.F) {
            return new Dimension(a2.getParent().getSize().width, super.getPreferredSize().height);
        }
        return super.getPreferredSize();
    }

    private /* synthetic */ void E(GridBagConstraints a2, vE a3, int a4) {
        sc_1 a5;
        a3 = sc_1.E((vE)a3);
        a5.E(a2, (JButton)a3, a4);
    }

    private static /* synthetic */ BufferedImage E(String a2) {
        try {
            return ImageIO.read(ba_2.class.getClassLoader().getResourceAsStream(a2));
        }
        catch (Exception exception) {
            return new BufferedImage(1, 1, 2);
        }
    }

    private /* synthetic */ Component E(sc_1 a2) {
        int n2;
        sc_1 a3;
        Component[] componentArray = a3.getComponents();
        int n3 = componentArray.length;
        int n4 = n2 = 0;
        while (n4 < n3) {
            Component component = componentArray[n2];
            if (component == a2) {
                return component;
            }
            if (component instanceof ue_1 && ((ue_1)((Object)component)).E(a2)) {
                return component;
            }
            n4 = ++n2;
        }
        return null;
    }

    public void E(boolean a2, int a3) {
        sc_1 a4;
        a4.l.put(a3, a2);
        a4.j(a3);
    }

    public int j(JLabel a22, Component a3, vE a4) {
        sc_1 a5;
        if (!a5.A.contains(a22)) {
            a22.setEnabled(a5.D);
        }
        if (!a5.A.contains(a3)) {
            a3.setEnabled(a5.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a5.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 1;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.anchor = 17;
        if (a5.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a5.E((Component)a22, gridBagConstraints, -1);
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints.anchor = 13;
        gridBagConstraints3.fill = 2;
        gridBagConstraints3.gridwidth = 3;
        gridBagConstraints.gridx = 3;
        a5.E(a3, gridBagConstraints, a22);
        if (a4 != null && !a4.E()) {
            a5.E(gridBagConstraints, a4, a22);
        }
        return a22;
    }

    public int E(JRadioButton a22, Component a3, vE a4) {
        sc_1 a5;
        if (!a5.A.contains(a22)) {
            a22.setEnabled(a5.D);
        }
        if (!a5.A.contains(a3)) {
            a3.setEnabled(a5.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a5.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 1;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.anchor = 17;
        if (a5.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a5.E((Component)a22, gridBagConstraints, -1);
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints3.anchor = 13;
        gridBagConstraints3.gridwidth = 3;
        gridBagConstraints.gridx = 3;
        a5.E(a3, gridBagConstraints, a22);
        if (a4 != null && !a4.E()) {
            a5.E(gridBagConstraints, a4, a22);
        }
        return a22;
    }

    public xf_1 E() {
        sc_1 a2;
        return a2.f;
    }

    public sc_1(String a2, String a3) {
        a4(a2, a3, -1, true, xf_1.M, af_0.B, null);
        sc_1 a4;
    }

    public int a(Component a22, vE a3) {
        sc_1 a4;
        if (!a4.A.contains(a22)) {
            a22.setEnabled(a4.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a4.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints3.gridwidth = 5;
        gridBagConstraints3.gridx = 1;
        gridBagConstraints3.insets = new Insets(0, 0, 0, 0);
        gridBagConstraints2.anchor = 17;
        gridBagConstraints2.fill = 2;
        if (a4.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a4.E(a22, gridBagConstraints, -1);
        if (a3 != null && !a3.E()) {
            a4.E(gridBagConstraints, a3, a22);
        }
        return a22;
    }

    public void E(int a2) {
        sc_1 a3;
        if (!a3.c.contains(a2)) {
            a3.c.add(a2);
            a3.j(a2);
        }
    }

    public int j(Component a22, Component a3, vE a4) {
        sc_1 a5;
        if (!a5.A.contains(a22)) {
            a22.setEnabled(a5.D);
        }
        if (!a5.A.contains(a3)) {
            a3.setEnabled(a5.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a5.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 1;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.anchor = 10;
        if (a5.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a5.E(a22, gridBagConstraints, -1);
        gridBagConstraints.gridwidth = 1;
        gridBagConstraints.gridx = 5;
        a5.E(a3, gridBagConstraints, a22);
        if (a4 != null && !a4.E()) {
            a5.E(gridBagConstraints, a4, a22);
        }
        return a22;
    }

    public int j(Component a22, Component a3, Component a4, vE a5) {
        sc_1 a6;
        if (!a6.A.contains(a22)) {
            a22.setEnabled(a6.D);
        }
        if (!a6.A.contains(a3)) {
            a3.setEnabled(a6.D);
        }
        if (!a6.A.contains(a4)) {
            a4.setEnabled(a6.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a6.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 1;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.fill = 2;
        if (a6.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a6.E(a22, gridBagConstraints, -1);
        gridBagConstraints.gridx = 5;
        gridBagConstraints.insets = new Insets(gridBagConstraints.insets.top, 10, 10, 0);
        a6.E(a4, gridBagConstraints, a22);
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints.gridx = 3;
        gridBagConstraints3.fill = 0;
        gridBagConstraints3.anchor = 13;
        gridBagConstraints3.insets = new Insets(gridBagConstraints.insets.top, 10, 10, 0);
        a6.E(a3, gridBagConstraints, a22);
        if (a5 != null && !a5.E()) {
            a6.E(gridBagConstraints, a5, a22);
        }
        return a22;
    }

    public int j(Component a2, vE a3) {
        sc_1 a4;
        sc_1 sc_12 = a4;
        return sc_12.E(a2, a3, sc_12.J++);
    }

    public int E(Component a22, Component a3, Component a4, vE a5) {
        sc_1 a6;
        if (!a6.A.contains(a22)) {
            a22.setEnabled(a6.D);
        }
        if (!a6.A.contains(a3)) {
            a3.setEnabled(a6.D);
        }
        if (!a6.A.contains(a4)) {
            a4.setEnabled(a6.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a6.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 1;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.fill = 2;
        if (a6.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a6.E(a22, gridBagConstraints, -1);
        gridBagConstraints.gridx = 3;
        gridBagConstraints.insets = new Insets(gridBagConstraints.insets.top, 10, 10, 0);
        a6.E(a3, gridBagConstraints, a22);
        gridBagConstraints.gridx = 5;
        gridBagConstraints.insets = new Insets(gridBagConstraints.insets.top, 10, 10, 0);
        a6.E(a4, gridBagConstraints, a22);
        if (a5 != null && !a5.E()) {
            a6.E(gridBagConstraints, a5, a22);
        }
        return a22;
    }

    public int E(JLabel a22, Component a3, JButton a4) {
        sc_1 a5;
        if (!a5.A.contains(a22)) {
            a22.setEnabled(a5.D);
        }
        if (!a5.A.contains(a3)) {
            a3.setEnabled(a5.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a5.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 1;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.anchor = 17;
        if (a5.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a5.E((Component)a22, gridBagConstraints, -1);
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints.anchor = 13;
        gridBagConstraints3.fill = 2;
        gridBagConstraints3.gridwidth = 3;
        gridBagConstraints.gridx = 3;
        a5.E(a3, gridBagConstraints, a22);
        if (a4 != null) {
            a5.E(gridBagConstraints, a4, a22);
        }
        return a22;
    }

    public int a(Component a2) {
        sc_1 a3;
        return a3.f(a2, null);
    }

    public int j(Component a2, Component a3) {
        sc_1 a4;
        return a4.j(a2, a3, new vE());
    }

    public int E(JLabel a2, Component a3) {
        sc_1 a4;
        return a4.E(a2, a3, (vE)null);
    }

    public boolean E(sc_1 a2) {
        int n2;
        int n3;
        sc_1 a3;
        block3: {
            if ((a2 = a3.E((sc_1)a2)) == null) {
                return false;
            }
            n3 = -1;
            for (Map.Entry<Integer, Set<Component>> entry : a3.j.entrySet()) {
                if (!entry.getValue().remove(a2)) continue;
                if (entry.getValue().size() != 0) break;
                n2 = n3 = entry.getKey().intValue();
                break block3;
            }
            n2 = n3;
        }
        if (n2 != -1) {
            a3.j.remove(n3);
        }
        SwingUtilities.invokeLater(() -> {
            sc_1 a3;
            sc_1 sc_12 = a3;
            super.remove(a2);
            super.repaint();
            super.revalidate();
        });
        return true;
    }

    public boolean a() {
        sc_1 a2;
        return a2.k;
    }

    public int j(Component a2, Component a3, Component a4) {
        sc_1 a5;
        return a5.E(a2, a3, a4, null);
    }

    private /* synthetic */ void E(GridBagConstraints a2, JButton a3, int a4) {
        sc_1 a5;
        GridBagConstraints gridBagConstraints = a2;
        GridBagConstraints gridBagConstraints2 = a2;
        gridBagConstraints2.anchor = 10;
        gridBagConstraints2.fill = 0;
        gridBagConstraints2.insets = new Insets(a2.insets.top, 3, a2.insets.bottom, 3);
        gridBagConstraints.gridwidth = 1;
        gridBagConstraints.gridx = 6;
        sc_1 sc_12 = a5;
        sc_12.E(a3);
        sc_12.E((Component)a3, a2, a4);
    }

    public int E(JCheckBox a2, Component a3) {
        sc_1 a4;
        return a4.j(a2, a3, null);
    }

    public int E(Component a22, Component a3, vE a4) {
        sc_1 a5;
        if (!a5.A.contains(a22)) {
            a22.setEnabled(a5.D);
        }
        if (!a5.A.contains(a3)) {
            a3.setEnabled(a5.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a5.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        GridBagConstraints gridBagConstraints4 = gridBagConstraints;
        GridBagConstraints gridBagConstraints5 = gridBagConstraints;
        gridBagConstraints5.gridx = 1;
        gridBagConstraints5.gridwidth = 1;
        gridBagConstraints4.weightx = 0.0;
        gridBagConstraints4.anchor = 17;
        gridBagConstraints3.insets = new Insets(5, 0, 0, 0);
        int a22 = a5.E(a22, gridBagConstraints, -1);
        gridBagConstraints3.gridx = 2;
        gridBagConstraints2.gridwidth = 4;
        gridBagConstraints2.weightx = 2.0;
        gridBagConstraints2.fill = 2;
        a5.E(a3, gridBagConstraints, a22);
        if (a4 != null && !a4.E()) {
            a5.E(gridBagConstraints, a4, a22);
        }
        return a22;
    }

    public int E(Component a2, Component a3, Component a4) {
        sc_1 a5;
        return a5.a(a2, a3, a4, null);
    }

    public int j(Component a2) {
        sc_1 a3;
        return a3.d(a2, (vE)null);
    }

    public static JButton E(vE a2) {
        if (a2 == null || a2.E()) {
            return null;
        }
        JButton jButton = new JButton(new ImageIcon(a2.b ? d : M));
        jButton.setBorder(BorderFactory.createEmptyBorder());
        JButton jButton2 = jButton;
        JButton jButton3 = jButton;
        jButton3.setToolTipText(a2.M);
        jButton3.setOpaque(false);
        jButton2.setContentAreaFilled(false);
        jButton2.setBorderPainted(false);
        if (!a2.j()) {
            jButton.addActionListener(new ff_2(a2));
        }
        return jButton;
    }

    public void E(Component a2) {
        sc_1 a3;
        a3.A.add(a2);
        a2.setEnabled(true);
    }

    public int E(Component a22, vE a3) {
        sc_1 a4;
        if (!a4.A.contains(a22)) {
            a22.setEnabled(a4.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a4.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 5;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.anchor = 17;
        if (a4.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a4.E(a22, gridBagConstraints, -1);
        if (a3 != null && !a3.E()) {
            a4.E(gridBagConstraints, a3, a22);
        }
        return a22;
    }

    public int E(Component a2) {
        sc_1 a3;
        return a3.a(a2, (vE)null);
    }

    public boolean j() {
        sc_1 a2;
        return a2.J == 0;
    }

    private /* synthetic */ int E(Component a2, GridBagConstraints a3, int a4) {
        sc_1 a5;
        if (a4 == -1) {
            a4 = a5.B++;
        }
        if (!a5.j.containsKey(a4)) {
            a5.j.put(a4, new HashSet());
        }
        a5.j.get(a4).add(a2);
        a5.add(a2, a3);
        return a4;
    }

    public int E(Component a2, int a3) {
        sc_1 a4;
        return a4.E(a2, (vE)null, a3);
    }

    public void E(sc_1 a2, sc_1 a3) {
        sc_1 a4;
        a4.E(a2, a3, 1);
    }

    public int E(JRadioButton a2, Component a3) {
        sc_1 a4;
        return a4.E(a2, a3, null);
    }

    public sc_1(String a2, String a3, String a4, int a5, boolean a6, xf_1 a7, af_0 a8, f_0 a9) {
        sc_1 a10;
        sc_1 sc_12 = a10;
        sc_1 sc_13 = a10;
        sc_1 sc_14 = a10;
        sc_1 sc_15 = a10;
        sc_1 sc_16 = a10;
        sc_1 sc_17 = a10;
        sc_1 sc_18 = a10;
        sc_1 sc_19 = a10;
        sc_1 sc_110 = a10;
        sc_110.J = 0;
        sc_19.K = null;
        sc_110.j = new TreeMap();
        sc_19.l = new TreeMap();
        sc_18.c = new ArrayList<Integer>();
        sc_18.A = new ArrayList<Component>();
        sc_18.D = true;
        sc_17.a = false;
        sc_17.F = false;
        sc_16.B = 1;
        sc_16.m = a4;
        sc_15.g = a5;
        sc_15.b = a9;
        sc_14.i = a2;
        sc_14.H = a3;
        sc_13.k = a6;
        sc_13.f = a7;
        a10.I = a8;
        sc_12.a = false;
        a2 = new GridBagLayout();
        new GridBagLayout().columnWidths = new int[]{10, 0, 10, 0, 10, 0, 10};
        ((GridBagLayout)a2).columnWeights = new double[]{0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0};
        a10.setLayout((LayoutManager)a2);
        sc_12.setDoubleBuffered(true);
        if (sc_12.b != null) {
            sc_1 sc_111 = a10;
            a10.a = a10.b.E(sc_111.i, sc_111.H);
        }
    }

    public void E(Consumer<String> a2) {
        a.K = a2;
    }

    public void E() {
        sc_1 a2;
        sc_1 sc_12 = a2;
        super.removeAll();
        sc_12.j.clear();
        sc_12.A.clear();
        sc_12.c.clear();
    }

    public int E(JLabel a22, Component a3, vE a4) {
        sc_1 a5;
        if (!a5.A.contains(a22)) {
            a22.setEnabled(a5.D);
        }
        if (!a5.A.contains(a3)) {
            a3.setEnabled(a5.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a5.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 1;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.anchor = 17;
        if (a5.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a5.E((Component)a22, gridBagConstraints, -1);
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints3.anchor = 13;
        gridBagConstraints3.gridwidth = 3;
        gridBagConstraints.gridx = 3;
        a5.E(a3, gridBagConstraints, a22);
        if (a4 != null && !a4.E()) {
            a5.E(gridBagConstraints, a4, a22);
        }
        return a22;
    }

    public int E(Component a2, Component a3) {
        sc_1 a4;
        return a4.a(a2, a3, (vE)null);
    }

    public int E(Component a22, vE a3, int a4) {
        sc_1 a5;
        if (!a5.A.contains(a22)) {
            a22.setEnabled(a5.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a4;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints3.gridwidth = 5;
        gridBagConstraints3.gridx = 1;
        gridBagConstraints3.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.anchor = 10;
        gridBagConstraints2.fill = 2;
        if (a5.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a5.E(a22, gridBagConstraints, -1);
        if (a3 != null && !a3.E()) {
            a5.E(gridBagConstraints, a3, a22);
        }
        return a22;
    }

    public int j(JCheckBox a22, Component a3, vE a4) {
        sc_1 a5;
        if (!a5.A.contains(a22)) {
            a22.setEnabled(a5.D);
        }
        if (!a5.A.contains(a3)) {
            a3.setEnabled(a5.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a5.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints3.gridwidth = 1;
        gridBagConstraints3.gridx = 1;
        gridBagConstraints3.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.anchor = 13;
        gridBagConstraints2.fill = 2;
        if (a5.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a5.E((Component)a22, gridBagConstraints, -1);
        GridBagConstraints gridBagConstraints4 = gridBagConstraints;
        gridBagConstraints4.anchor = 17;
        gridBagConstraints4.gridwidth = 3;
        gridBagConstraints.gridx = 3;
        a5.E(a3, gridBagConstraints, a22);
        if (a4 != null && !a4.E()) {
            a5.E(gridBagConstraints, a4, a22);
        }
        return a22;
    }

    public int E(JCheckBox a22, Component a3, vE a4) {
        sc_1 a5;
        if (!a5.A.contains(a22)) {
            a22.setEnabled(a5.D);
        }
        if (!a5.A.contains(a3)) {
            a3.setEnabled(a5.D);
        }
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().gridy = a5.J++;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        gridBagConstraints.gridwidth = 1;
        gridBagConstraints2.gridx = 1;
        gridBagConstraints2.insets = new Insets(10, 0, 0, 0);
        gridBagConstraints2.anchor = 17;
        if (a5.J == 1) {
            gridBagConstraints.insets.top = 5;
        }
        int a22 = a5.E((Component)a22, gridBagConstraints, -1);
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints.anchor = 13;
        gridBagConstraints3.fill = 2;
        gridBagConstraints3.gridwidth = 3;
        gridBagConstraints.gridx = 3;
        a5.E(a3, gridBagConstraints, a22);
        if (a4 != null && !a4.E()) {
            a5.E(gridBagConstraints, a4, a22);
        }
        return a22;
    }

    public sc_1(String a2, ne_2 a3, f_0 a4) {
        a5(a2, a3.E(), a3.E(), a3.E(), a3.E(), a3.E(), a4);
        sc_1 a5;
    }

    public boolean E() {
        Iterator<Integer> iterator;
        sc_1 a2;
        a2.a = !a2.a;
        Iterator<Integer> iterator2 = iterator = a2.c.iterator();
        while (iterator2.hasNext()) {
            Integer n2 = iterator.next();
            iterator2 = iterator;
            a2.j(n2);
        }
        if (a2.b != null) {
            sc_1 sc_12 = a2;
            sc_1 sc_13 = a2;
            sc_12.b.E(sc_12.i, sc_13.H, sc_13.a);
        }
        return a2.a;
    }

    public sc_1(String a2, String a3, int a4, boolean a5, xf_1 a6, af_0 a7, f_0 a8) {
        sc_1 a9;
        String string;
        String string2;
        if (a3 == null) {
            string2 = "";
            string = a3;
        } else {
            string2 = a3.replaceAll(qe_2.E("Sy$"), "");
            string = a3;
        }
        a9(a2, string2, string, a4, a5, a6, a7, a8);
    }
}

