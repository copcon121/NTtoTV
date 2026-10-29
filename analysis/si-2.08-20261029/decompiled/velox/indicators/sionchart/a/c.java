/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.colors.ColorsConfigItem
 */
package velox.indicators.sionchart.a;

import java.awt.Color;
import java.util.function.Consumer;
import javax.swing.BoxLayout;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JSlider;
import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import velox.gui.colors.ColorsConfigItem;
import velox.indicators.sionchart.b.t;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.m;

public class c {
    final m a;
    private final JLabel D = new JLabel();
    private final JSlider E = new JSlider(0, 12, 30, 20);
    public final JPanel b = new JPanel();
    private final JLabel F = new JLabel();
    private final JSlider G = new JSlider(0, 0, 200, 30);
    public final JPanel c = new JPanel();
    private final JLabel H = new JLabel();
    private final JSlider I = new JSlider(0, 1, 5, 3);
    public final JPanel d = new JPanel();
    private final JLabel J = new JLabel();
    private final JSlider K = new JSlider(0, 1, 5, 2);
    public final JPanel e = new JPanel();
    private final JLabel L = new JLabel();
    private final JSlider M = new JSlider(0, 10, 200, 10);
    public final JPanel f = new JPanel();
    private final JLabel N = new JLabel();
    private final JSlider O = new JSlider(0, 10, 100, 10);
    public final JPanel g = new JPanel();
    ColorsConfigItem h;
    ColorsConfigItem i;
    public final JSpinner j = new JSpinner();
    final JSpinner k = new JSpinner();
    final JCheckBox l = new JCheckBox("Show icebergs");
    final JCheckBox m = new JCheckBox("Show detection icons");
    final JCheckBox n = new JCheckBox("Show trade icons");
    final JCheckBox o = new JCheckBox("Show cancellation icons");
    final JCheckBox p = new JCheckBox("Show execution icons");
    final JCheckBox q = new JCheckBox("Show active icons");
    final JCheckBox r = new JCheckBox("Show total volume");
    final JCheckBox s = new JCheckBox("Show event type");
    final JCheckBox t = new JCheckBox("Show event volume");
    final JCheckBox u = new JCheckBox("Show icebergs number");
    final JCheckBox v = new JCheckBox("Apply threshold to active icebergs");
    final JCheckBox w = new JCheckBox("Automatic individual threshold");
    final JCheckBox x = new JCheckBox("Show filtered icons");
    final JCheckBox y = new JCheckBox("Aggregate E and C");
    final JCheckBox z = new JCheckBox("Not aggregated view");
    final JSpinner A = new JSpinner();
    private final JLabel P = new JLabel();
    private final JSlider Q = new JSlider(0, 0, 100, 0);
    public final JPanel B = new JPanel();
    private final JLabel R = new JLabel();
    private final JSlider S = new JSlider(0, 30, 90, 30);
    public final JPanel C = new JPanel();

    public c(m m2) {
        this.a = m2;
        this.a();
        this.b();
    }

    void a() {
        e e2 = this.a.c();
        this.b.setLayout(new BoxLayout(this.b, 1));
        this.b.add(this.D);
        this.b.add(this.E);
        this.D.setAlignmentX(0.5f);
        this.E.addChangeListener(changeEvent -> {
            e2.icebergsIconsHeight = this.E.getValue();
            this.D.setText(Integer.toString(this.E.getValue()));
            this.a.d();
            this.E.repaint();
        });
        this.E.setName(this.a.e() + ";icebergsIconsSize");
        this.d.setLayout(new BoxLayout(this.d, 1));
        this.d.add(this.H);
        this.d.add(this.I);
        this.H.setAlignmentX(0.5f);
        this.I.addChangeListener(changeEvent -> {
            e2.icebergsOrderLineWidth = this.I.getValue();
            this.H.setText(Integer.toString(this.I.getValue()));
            this.a.d();
            this.I.repaint();
        });
        this.I.setName(this.a.e() + ";icebergsOrderLineWidth");
        this.e.setLayout(new BoxLayout(this.e, 1));
        this.e.add(this.J);
        this.e.add(this.K);
        this.J.setAlignmentX(0.5f);
        this.K.addChangeListener(changeEvent -> {
            e2.icebergsOffsetLineWidth = this.K.getValue();
            this.J.setText(Integer.toString(this.K.getValue()));
            this.a.d();
            this.K.repaint();
        });
        this.K.setName(this.a.e() + ";icebergsOffsetLineWidth");
        this.c.setLayout(new BoxLayout(this.c, 1));
        this.c.add(this.F);
        this.c.add(this.G);
        this.F.setAlignmentX(0.5f);
        this.G.addChangeListener(changeEvent -> {
            e2.icebergsIconsOffset = this.G.getValue();
            this.F.setText(Integer.toString(this.G.getValue()));
            this.a.d();
        });
        this.G.setName(this.a.e() + ";icebergsIconsOffset");
        this.f.setLayout(new BoxLayout(this.f, 1));
        this.f.add(this.L);
        this.f.add(this.M);
        this.L.setAlignmentX(0.5f);
        this.M.addChangeListener(changeEvent -> {
            e2.icebergsPriceAreaMultiplier = this.M.getValue();
            this.L.setText(Double.toString((double)this.M.getValue() / 10.0));
            this.a.d();
            this.M.repaint();
        });
        this.M.setName(this.a.e() + ";icebergsPriceAreaMultiplier");
        this.g.setLayout(new BoxLayout(this.g, 1));
        this.g.add(this.N);
        this.g.add(this.O);
        this.N.setAlignmentX(0.5f);
        this.O.addChangeListener(changeEvent -> {
            e2.icebergsTimeAreaMultiplier = this.O.getValue();
            this.N.setText(Double.toString((double)this.O.getValue() / 10.0));
            this.a.d();
            this.O.repaint();
        });
        this.O.setName(this.a.e() + ";icebergsTimeAreaMultiplier");
        SpinnerNumberModel spinnerNumberModel = new SpinnerNumberModel(0, 0, Integer.MAX_VALUE, 1);
        this.j.setModel(spinnerNumberModel);
        velox.indicators.sionchart.b.t.a(this.j);
        this.j.addChangeListener(changeEvent -> {
            e2.icebergsThreshold = (Integer)this.j.getValue();
            this.a.d();
            this.a.p();
        });
        this.j.setName(this.a.e() + ";icebergsThresholdSize");
        this.k.setModel(new SpinnerNumberModel(0, 0, Integer.MAX_VALUE, 1));
        velox.indicators.sionchart.b.t.a(this.k);
        this.k.addChangeListener(changeEvent -> {
            e2.icebergsAggThreshold = (Integer)this.k.getValue();
            this.a.d();
        });
        this.k.setName(this.a.e() + ";icebergsAggThresholdSize");
        Consumer<Color> consumer = color -> {
            e2.icebergsAskColor = color;
            this.a.d();
        };
        this.h = new ColorsConfigItem(e2.icebergsAskColor, velox.indicators.sionchart.m.a, consumer);
        this.h.setName(this.a.e() + ";icebergsAsksColorConfig");
        Consumer<Color> consumer2 = color -> {
            e2.icebergsBidColor = color;
            this.a.d();
        };
        this.i = new ColorsConfigItem(e2.icebergsBidColor, velox.indicators.sionchart.m.b, consumer2);
        this.i.setName(this.a.e() + ";icebergsBidsColorConfig");
        this.l.addActionListener(actionEvent -> {
            e2.showIcebergs = this.l.isSelected();
            this.a.d();
        });
        this.l.setName(this.a.e() + ";showIcebergs");
        this.m.addActionListener(actionEvent -> {
            e2.showDetection = this.m.isSelected();
            this.a.d();
        });
        this.m.setName(this.a.e() + ";showDetections");
        this.n.addActionListener(actionEvent -> {
            e2.showTrades = this.n.isSelected();
            this.a.d();
        });
        this.n.setName(this.a.e() + ";showTrades");
        this.p.addActionListener(actionEvent -> {
            e2.showExecution = this.p.isSelected();
            if (e2.icebergsAutoThreshold) {
                this.a.b(true);
            }
            this.a.d();
        });
        this.p.setName(this.a.e() + ";showExecutions");
        this.o.addActionListener(actionEvent -> {
            e2.showCancellation = this.o.isSelected();
            if (e2.icebergsAutoThreshold) {
                this.a.b(true);
            }
            this.a.d();
        });
        this.o.setName(this.a.e() + ";showCancellations");
        this.q.addActionListener(actionEvent -> {
            e2.showActive = this.q.isSelected();
            if (e2.icebergsAutoThreshold) {
                this.a.b(true);
            }
            this.a.d();
        });
        this.q.setName(this.a.e() + ";showActive");
        if (this.a.A) {
            this.q.setEnabled(false);
        }
        this.r.addActionListener(actionEvent -> {
            e2.showTotals = this.r.isSelected();
            this.a.d();
        });
        this.r.setName(this.a.e() + ";showTotals");
        this.s.addActionListener(actionEvent -> {
            e2.showLetters = this.s.isSelected();
            this.a.d();
        });
        this.s.setName(this.a.e() + ";showLetters");
        this.t.addActionListener(actionEvent -> {
            e2.showEventVolumes = this.t.isSelected();
            this.a.d();
        });
        this.t.setName(this.a.e() + ";showEventVolumes");
        this.u.addActionListener(actionEvent -> {
            e2.showIcebergsNumber = this.u.isSelected();
            this.a.d();
        });
        this.u.setName(this.a.e() + ";showIcebergsNumber");
        this.v.addActionListener(actionEvent -> {
            e2.applyThresholdToActive = this.v.isSelected();
            this.a.d();
        });
        this.v.setName(this.a.e() + ";applyThresholdToActiveIcebergs");
        this.x.addActionListener(actionEvent -> {
            e2.icebergsShowHiddenIcons = this.x.isSelected();
            this.a.d();
            this.R.setEnabled(this.x.isSelected());
            this.S.setEnabled(this.x.isSelected());
        });
        this.x.setName(this.a.e() + ";icebergsShowHiddenIcons");
        this.y.addActionListener(actionEvent -> {
            e2.aggregateEC = this.y.isSelected();
            this.a.d();
        });
        this.y.setToolTipText("Calculate executed and partially executed icebergs volume together");
        this.y.setName(this.a.e() + ";aggregateEC");
        this.z.addActionListener(actionEvent -> {
            e2.icebergsNotAggregated = this.z.isSelected();
            this.a.d();
            this.L.setEnabled(!this.z.isSelected());
            this.M.setEnabled(!this.z.isSelected());
            this.N.setEnabled(!this.z.isSelected());
            this.O.setEnabled(!this.z.isSelected());
        });
        this.z.setToolTipText("Disable icons aggregation");
        this.z.setName(this.a.e() + ";icebergsNotAggregated");
        SpinnerNumberModel spinnerNumberModel2 = new SpinnerNumberModel(1, 1, 1440, 1);
        this.A.setModel(spinnerNumberModel2);
        this.A.setToolTipText("Values range: " + spinnerNumberModel2.getMinimum() + ".." + spinnerNumberModel2.getMaximum());
        velox.indicators.sionchart.b.t.a(this.A);
        this.A.addChangeListener(changeEvent -> {
            e2.icebergsSdInterval = (Integer)this.A.getValue();
            if (e2.icebergsAutoThreshold) {
                this.a.b(true);
            }
            this.a.d();
        });
        this.A.setName(this.a.e() + ";icebergsSdInterval");
        this.B.setLayout(new BoxLayout(this.B, 1));
        this.B.add(this.P);
        this.B.add(this.Q);
        this.P.setAlignmentX(0.5f);
        this.Q.addChangeListener(changeEvent -> {
            e2.icebergsSdMultiplier = this.c();
            this.P.setText(Double.toString(this.c()));
            if (e2.icebergsAutoThreshold) {
                this.a.b(true);
            }
            this.a.d();
        });
        this.Q.setName(this.a.e() + ";icebergsSdMultiplier");
        this.C.setLayout(new BoxLayout(this.C, 1));
        this.C.add(this.R);
        this.C.add(this.S);
        this.R.setAlignmentX(0.5f);
        this.S.addChangeListener(changeEvent -> {
            e2.icebergsHiddenTransparency = this.S.getValue();
            this.R.setText(Integer.toString(this.S.getValue()));
            this.a.d();
        });
        this.R.setName(this.a.e() + ";hiddenIcebergsTransparency");
        this.w.addActionListener(actionEvent -> {
            e2.icebergsAutoThreshold = this.w.isSelected();
            this.j.setEnabled(!e2.icebergsAutoThreshold);
            this.A.setEnabled(e2.icebergsAutoThreshold);
            this.Q.setEnabled(e2.icebergsAutoThreshold);
            this.P.setEnabled(e2.icebergsAutoThreshold);
            if (e2.icebergsAutoThreshold) {
                this.a.b(true);
            }
            this.a.d();
        });
        this.w.setName(this.a.e() + ";icebergsAutoThreshold");
    }

    void b() {
        e e2 = this.a.c();
        this.E.setValue(e2.icebergsIconsHeight);
        this.D.setText(Integer.toString(this.E.getValue()));
        this.G.setValue(e2.icebergsIconsOffset);
        this.F.setText(Integer.toString(this.G.getValue()));
        this.G.setValue(e2.icebergsIconsOffset);
        this.F.setText(Integer.toString(this.G.getValue()));
        this.I.setValue(e2.icebergsOrderLineWidth);
        this.H.setText(Integer.toString(this.I.getValue()));
        this.K.setValue(e2.icebergsOffsetLineWidth);
        this.J.setText(Integer.toString(this.K.getValue()));
        this.M.setValue(e2.icebergsPriceAreaMultiplier);
        this.L.setText(Double.toString((double)this.M.getValue() / 10.0));
        this.O.setValue(e2.icebergsTimeAreaMultiplier);
        this.N.setText(Double.toString((double)this.O.getValue() / 10.0));
        this.O.setValue(e2.icebergsTimeAreaMultiplier);
        this.N.setText(Double.toString((double)this.O.getValue() / 10.0));
        this.h.setColor(e2.icebergsAskColor, true);
        this.i.setColor(e2.icebergsBidColor, true);
        this.j.setValue(e2.icebergsThreshold);
        this.k.setValue(e2.icebergsAggThreshold);
        this.l.setSelected(e2.showIcebergs);
        this.m.setSelected(e2.showDetection);
        this.n.setSelected(e2.showTrades);
        this.o.setSelected(e2.showCancellation);
        this.p.setSelected(e2.showExecution);
        this.q.setSelected(e2.showActive);
        this.r.setSelected(e2.showTotals);
        this.s.setSelected(e2.showLetters);
        this.t.setSelected(e2.showEventVolumes);
        this.u.setSelected(e2.showIcebergsNumber);
        this.v.setSelected(e2.applyThresholdToActive);
        this.w.setSelected(e2.icebergsAutoThreshold);
        if (e2.icebergsAutoThreshold) {
            this.a.b(true);
        }
        this.j.setEnabled(!e2.icebergsAutoThreshold);
        this.A.setEnabled(e2.icebergsAutoThreshold);
        this.Q.setEnabled(e2.icebergsAutoThreshold);
        this.P.setEnabled(e2.icebergsAutoThreshold);
        this.x.setSelected(e2.icebergsShowHiddenIcons);
        this.S.setEnabled(this.x.isSelected());
        this.R.setEnabled(this.x.isSelected());
        this.y.setSelected(e2.aggregateEC);
        this.A.setEnabled(e2.icebergsAutoThreshold);
        this.A.setValue(e2.icebergsSdInterval);
        this.a(e2.icebergsSdMultiplier);
        this.S.setValue(e2.icebergsHiddenTransparency);
        this.R.setText(Integer.toString(e2.icebergsHiddenTransparency));
        this.z.setSelected(e2.icebergsNotAggregated);
        this.L.setEnabled(!this.z.isSelected());
        this.M.setEnabled(!this.z.isSelected());
        this.N.setEnabled(!this.z.isSelected());
        this.O.setEnabled(!this.z.isSelected());
    }

    private double c() {
        return (double)this.Q.getValue() / 10.0;
    }

    private void a(double d2) {
        this.Q.setValue((int)(d2 * 10.0));
    }
}

