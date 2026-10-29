/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.colors.ColorsConfigItem
 */
package velox.indicators.sionchart;

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
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.a.t;
import velox.indicators.sionchart.d;

public class e {
    final SitIndicator a;
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
    final JSpinner j = new JSpinner();
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
    private final JSlider S = new JSlider(0, 10, 90, 10);
    public final JPanel C = new JPanel();

    public e(SitIndicator sitIndicator) {
        this.a = sitIndicator;
        this.a();
        this.b();
    }

    void a() {
        d d2 = this.a.c();
        this.b.setLayout(new BoxLayout(this.b, 1));
        this.b.add(this.D);
        this.b.add(this.E);
        this.D.setAlignmentX(0.5f);
        this.E.addChangeListener(changeEvent -> {
            d2.icebergsIconsHeight = this.E.getValue();
            this.D.setText(Integer.toString(this.E.getValue()));
            this.a.d();
            this.E.repaint();
        });
        this.E.setName("Stops&Icebergs On-Chart;icebergsIconsSize");
        this.d.setLayout(new BoxLayout(this.d, 1));
        this.d.add(this.H);
        this.d.add(this.I);
        this.H.setAlignmentX(0.5f);
        this.I.addChangeListener(changeEvent -> {
            d2.icebergsOrderLineWidth = this.I.getValue();
            this.H.setText(Integer.toString(this.I.getValue()));
            this.a.d();
            this.I.repaint();
        });
        this.I.setName("Stops&Icebergs On-Chart;icebergsOrderLineWidth");
        this.e.setLayout(new BoxLayout(this.e, 1));
        this.e.add(this.J);
        this.e.add(this.K);
        this.J.setAlignmentX(0.5f);
        this.K.addChangeListener(changeEvent -> {
            d2.icebergsOffsetLineWidth = this.K.getValue();
            this.J.setText(Integer.toString(this.K.getValue()));
            this.a.d();
            this.K.repaint();
        });
        this.K.setName("Stops&Icebergs On-Chart;icebergsOffsetLineWidth");
        this.c.setLayout(new BoxLayout(this.c, 1));
        this.c.add(this.F);
        this.c.add(this.G);
        this.F.setAlignmentX(0.5f);
        this.G.addChangeListener(changeEvent -> {
            d2.icebergsIconsOffset = this.G.getValue();
            this.F.setText(Integer.toString(this.G.getValue()));
            this.a.d();
        });
        this.G.setName("Stops&Icebergs On-Chart;icebergsIconsOffset");
        this.f.setLayout(new BoxLayout(this.f, 1));
        this.f.add(this.L);
        this.f.add(this.M);
        this.L.setAlignmentX(0.5f);
        this.M.addChangeListener(changeEvent -> {
            d2.icebergsPriceAreaMultiplier = this.M.getValue();
            this.L.setText(Double.toString((double)this.M.getValue() / 10.0));
            this.a.d();
            this.M.repaint();
        });
        this.M.setName("Stops&Icebergs On-Chart;icebergsPriceAreaMultiplier");
        this.g.setLayout(new BoxLayout(this.g, 1));
        this.g.add(this.N);
        this.g.add(this.O);
        this.N.setAlignmentX(0.5f);
        this.O.addChangeListener(changeEvent -> {
            d2.icebergsTimeAreaMultiplier = this.O.getValue();
            this.N.setText(Double.toString((double)this.O.getValue() / 10.0));
            this.a.d();
            this.O.repaint();
        });
        this.O.setName("Stops&Icebergs On-Chart;icebergsTimeAreaMultiplier");
        SpinnerNumberModel spinnerNumberModel = new SpinnerNumberModel(0, 0, Integer.MAX_VALUE, 1);
        this.j.setModel(spinnerNumberModel);
        velox.indicators.sionchart.a.t.a(this.j);
        this.j.addChangeListener(changeEvent -> {
            d2.icebergsThreshold = (Integer)this.j.getValue();
            this.a.d();
        });
        this.j.setName("Stops&Icebergs On-Chart;icebergsThresholdSize");
        this.k.setModel(new SpinnerNumberModel(0, 0, Integer.MAX_VALUE, 1));
        velox.indicators.sionchart.a.t.a(this.k);
        this.k.addChangeListener(changeEvent -> {
            d2.icebergsAggThreshold = (Integer)this.k.getValue();
            this.a.d();
        });
        this.k.setName("Stops&Icebergs On-Chart;icebergsAggThresholdSize");
        Consumer<Color> consumer = color -> {
            d2.icebergsAskColor = color;
            this.a.d();
        };
        this.h = new ColorsConfigItem(d2.icebergsAskColor, SitIndicator.c, consumer);
        this.h.setName("Stops&Icebergs On-Chart;icebergsAsksColorConfig");
        Consumer<Color> consumer2 = color -> {
            d2.icebergsBidColor = color;
            this.a.d();
        };
        this.i = new ColorsConfigItem(d2.icebergsBidColor, SitIndicator.d, consumer2);
        this.i.setName("Stops&Icebergs On-Chart;icebergsBidsColorConfig");
        this.l.addActionListener(actionEvent -> {
            d2.showIcebergs = this.l.isSelected();
            this.a.d();
        });
        this.l.setName("Stops&Icebergs On-Chart;showIcebergs");
        this.m.addActionListener(actionEvent -> {
            d2.showDetection = this.m.isSelected();
            this.a.d();
        });
        this.m.setName("Stops&Icebergs On-Chart;showDetections");
        this.n.addActionListener(actionEvent -> {
            d2.showTrades = this.n.isSelected();
            this.a.d();
        });
        this.n.setName("Stops&Icebergs On-Chart;showTrades");
        this.p.addActionListener(actionEvent -> {
            d2.showExecution = this.p.isSelected();
            if (d2.icebergsAutoThreshold) {
                this.a.c(true);
            }
            this.a.d();
        });
        this.p.setName("Stops&Icebergs On-Chart;showExecutions");
        this.o.addActionListener(actionEvent -> {
            d2.showCancellation = this.o.isSelected();
            if (d2.icebergsAutoThreshold) {
                this.a.c(true);
            }
            this.a.d();
        });
        this.o.setName("Stops&Icebergs On-Chart;showCancellations");
        this.q.addActionListener(actionEvent -> {
            d2.showActive = this.q.isSelected();
            if (d2.icebergsAutoThreshold) {
                this.a.c(true);
            }
            this.a.d();
        });
        this.q.setName("Stops&Icebergs On-Chart;showActive");
        this.r.addActionListener(actionEvent -> {
            d2.showTotals = this.r.isSelected();
            this.a.d();
        });
        this.r.setName("Stops&Icebergs On-Chart;showTotals");
        this.s.addActionListener(actionEvent -> {
            d2.showLetters = this.s.isSelected();
            this.a.d();
        });
        this.s.setName("Stops&Icebergs On-Chart;showLetters");
        this.t.addActionListener(actionEvent -> {
            d2.showEventVolumes = this.t.isSelected();
            this.a.d();
        });
        this.t.setName("Stops&Icebergs On-Chart;showEventVolumes");
        this.u.addActionListener(actionEvent -> {
            d2.showIcebergsNumber = this.u.isSelected();
            this.a.d();
        });
        this.u.setName("Stops&Icebergs On-Chart;showIcebergsNumber");
        this.v.addActionListener(actionEvent -> {
            d2.applyThresholdToActive = this.v.isSelected();
            this.a.d();
        });
        this.v.setName("Stops&Icebergs On-Chart;applyThresholdToActiveIcebergs");
        this.x.addActionListener(actionEvent -> {
            d2.icebergsShowHiddenIcons = this.x.isSelected();
            this.a.d();
            this.R.setEnabled(this.x.isSelected());
            this.S.setEnabled(this.x.isSelected());
        });
        this.x.setName("Stops&Icebergs On-Chart;icebergsShowHiddenIcons");
        this.y.addActionListener(actionEvent -> {
            d2.aggregateEC = this.y.isSelected();
            this.a.d();
        });
        this.y.setToolTipText("Calculate executed and partially executed icebergs volume together");
        this.y.setName("Stops&Icebergs On-Chart;aggregateEC");
        this.z.addActionListener(actionEvent -> {
            d2.icebergsNotAggregated = this.z.isSelected();
            this.a.d();
            this.L.setEnabled(!this.z.isSelected());
            this.M.setEnabled(!this.z.isSelected());
            this.N.setEnabled(!this.z.isSelected());
            this.O.setEnabled(!this.z.isSelected());
        });
        this.z.setToolTipText("Disable icons aggregation");
        this.z.setName("Stops&Icebergs On-Chart;icebergsNotAggregated");
        SpinnerNumberModel spinnerNumberModel2 = new SpinnerNumberModel(1, 1, 1440, 1);
        this.A.setModel(spinnerNumberModel2);
        this.A.setToolTipText("Values range: " + spinnerNumberModel2.getMinimum() + ".." + spinnerNumberModel2.getMaximum());
        velox.indicators.sionchart.a.t.a(this.A);
        this.A.addChangeListener(changeEvent -> {
            d2.icebergsSdInterval = (Integer)this.A.getValue();
            if (d2.icebergsAutoThreshold) {
                this.a.c(true);
            }
            this.a.d();
        });
        this.A.setName("Stops&Icebergs On-Chart;icebergsSdInterval");
        this.B.setLayout(new BoxLayout(this.B, 1));
        this.B.add(this.P);
        this.B.add(this.Q);
        this.P.setAlignmentX(0.5f);
        this.Q.addChangeListener(changeEvent -> {
            d2.icebergsSdMultiplier = this.c();
            this.P.setText(Double.toString(this.c()));
            if (d2.icebergsAutoThreshold) {
                this.a.c(true);
            }
            this.a.d();
        });
        this.Q.setName("Stops&Icebergs On-Chart;icebergsSdMultiplier");
        this.C.setLayout(new BoxLayout(this.C, 1));
        this.C.add(this.R);
        this.C.add(this.S);
        this.R.setAlignmentX(0.5f);
        this.S.addChangeListener(changeEvent -> {
            d2.icebergsHiddenTransparency = this.S.getValue();
            this.R.setText(Integer.toString(this.S.getValue()));
            this.a.d();
        });
        this.R.setName("Stops&Icebergs On-Chart;hiddenIcebergsTransparency");
        this.w.addActionListener(actionEvent -> {
            d2.icebergsAutoThreshold = this.w.isSelected();
            this.j.setEnabled(!d2.icebergsAutoThreshold);
            this.A.setEnabled(d2.icebergsAutoThreshold);
            this.Q.setEnabled(d2.icebergsAutoThreshold);
            this.P.setEnabled(d2.icebergsAutoThreshold);
            if (d2.icebergsAutoThreshold) {
                this.a.c(true);
            }
            this.a.d();
        });
        this.w.setName("Stops&Icebergs On-Chart;icebergsAutoThreshold");
    }

    void b() {
        d d2 = this.a.c();
        this.E.setValue(d2.icebergsIconsHeight);
        this.D.setText(Integer.toString(this.E.getValue()));
        this.G.setValue(d2.icebergsIconsOffset);
        this.F.setText(Integer.toString(this.G.getValue()));
        this.G.setValue(d2.icebergsIconsOffset);
        this.F.setText(Integer.toString(this.G.getValue()));
        this.I.setValue(d2.icebergsOrderLineWidth);
        this.H.setText(Integer.toString(this.I.getValue()));
        this.K.setValue(d2.icebergsOffsetLineWidth);
        this.J.setText(Integer.toString(this.K.getValue()));
        this.M.setValue(d2.icebergsPriceAreaMultiplier);
        this.L.setText(Double.toString((double)this.M.getValue() / 10.0));
        this.O.setValue(d2.icebergsTimeAreaMultiplier);
        this.N.setText(Double.toString((double)this.O.getValue() / 10.0));
        this.O.setValue(d2.icebergsTimeAreaMultiplier);
        this.N.setText(Double.toString((double)this.O.getValue() / 10.0));
        this.h.setColor(d2.icebergsAskColor, true);
        this.i.setColor(d2.icebergsBidColor, true);
        this.j.setValue(d2.icebergsThreshold);
        this.k.setValue(d2.icebergsAggThreshold);
        this.l.setSelected(d2.showIcebergs);
        this.m.setSelected(d2.showDetection);
        this.n.setSelected(d2.showTrades);
        this.o.setSelected(d2.showCancellation);
        this.p.setSelected(d2.showExecution);
        this.q.setSelected(d2.showActive);
        this.r.setSelected(d2.showTotals);
        this.s.setSelected(d2.showLetters);
        this.t.setSelected(d2.showEventVolumes);
        this.u.setSelected(d2.showIcebergsNumber);
        this.v.setSelected(d2.applyThresholdToActive);
        this.w.setSelected(d2.icebergsAutoThreshold);
        if (d2.icebergsAutoThreshold) {
            this.a.c(true);
        }
        this.j.setEnabled(!d2.icebergsAutoThreshold);
        this.A.setEnabled(d2.icebergsAutoThreshold);
        this.Q.setEnabled(d2.icebergsAutoThreshold);
        this.P.setEnabled(d2.icebergsAutoThreshold);
        this.x.setSelected(d2.icebergsShowHiddenIcons);
        this.S.setEnabled(this.x.isSelected());
        this.R.setEnabled(this.x.isSelected());
        this.y.setSelected(d2.aggregateEC);
        this.A.setEnabled(d2.icebergsAutoThreshold);
        this.A.setValue(d2.icebergsSdInterval);
        this.a(d2.icebergsSdMultiplier);
        this.S.setValue(d2.icebergsHiddenTransparency);
        this.R.setText(Integer.toString(d2.icebergsHiddenTransparency));
        this.z.setSelected(d2.icebergsNotAggregated);
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

