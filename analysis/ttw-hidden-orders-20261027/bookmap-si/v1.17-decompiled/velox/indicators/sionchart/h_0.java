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
import velox.indicators.sionchart.e;

/*
 * Renamed from velox.indicators.sionchart.H
 */
public class h_0 {
    final SitIndicator a;
    ColorsConfigItem b;
    ColorsConfigItem c;
    final JSpinner d = new JSpinner();
    final JSpinner e = new JSpinner();
    final JCheckBox f = new JCheckBox("Show only stop runs");
    final JCheckBox g = new JCheckBox("Show stops      ");
    final JCheckBox h = new JCheckBox("Show volumes");
    final JCheckBox i = new JCheckBox("Show stop chains number");
    final JCheckBox j = new JCheckBox("Show filtered icons");
    final JCheckBox k = new JCheckBox("Not aggregated view");
    private final JLabel v = new JLabel();
    private final JSlider w = new JSlider(0, 12, 30, 20);
    public final JPanel l = new JPanel();
    private final JLabel x = new JLabel();
    private final JSlider y = new JSlider(0, 0, 200, 30);
    public final JPanel m = new JPanel();
    private final JLabel z = new JLabel();
    private final JSlider A = new JSlider(0, 1, 5, 3);
    public final JPanel n = new JPanel();
    private final JLabel B = new JLabel();
    private final JSlider C = new JSlider(0, 1, 5, 2);
    public final JPanel o = new JPanel();
    private final JLabel D = new JLabel();
    private final JSlider E = new JSlider(0, 10, 200, 10);
    public final JPanel p = new JPanel();
    private final JLabel F = new JLabel();
    private final JSlider G = new JSlider(0, 10, 100, 10);
    public final JPanel q = new JPanel();
    final JCheckBox r = new JCheckBox("Automatic individual threshold");
    JSpinner s = new JSpinner();
    private final JLabel H = new JLabel();
    private final JSlider I = new JSlider(0, 0, 100, 0);
    public final JPanel t = new JPanel();
    private final JLabel J = new JLabel();
    private final JSlider K = new JSlider(0, 30, 90, 30);
    public final JPanel u = new JPanel();

    public h_0(SitIndicator sitIndicator) {
        this.a = sitIndicator;
        this.a();
        this.b();
    }

    void a() {
        e e2 = this.a.e();
        Consumer<Color> consumer = color -> {
            e2.stopsAskColor = color;
            this.a.f();
        };
        this.b = new ColorsConfigItem(e2.stopsAskColor, SitIndicator.e, consumer);
        this.b.setName("Stops&Icebergs On-Chart;stopsAsksColorConfig");
        Consumer<Color> consumer2 = color -> {
            e2.stopsBidColor = color;
            this.a.f();
        };
        this.c = new ColorsConfigItem(e2.stopsBidColor, SitIndicator.f, consumer2);
        this.c.setName("Stops&Icebergs On-Chart;stopsBidsColorConfig");
        this.g.addActionListener(actionEvent -> {
            e2.showStops = this.g.isSelected();
            this.a.f();
        });
        this.g.setName("Stops&Icebergs On-Chart;showStops");
        this.f.addActionListener(actionEvent -> {
            e2.showOnlyStopsTBPL = this.f.isSelected();
            this.a.f();
        });
        this.f.setName("Stops&Icebergs On-Chart;showOnlyStopsThatBreakPriceLevel");
        this.h.addActionListener(actionEvent -> {
            e2.showStopsTotals = this.h.isSelected();
            this.a.f();
        });
        this.h.setName("Stops&Icebergs On-Chart;showVolumes");
        this.i.addActionListener(actionEvent -> {
            e2.showStopsNumber = this.i.isSelected();
            this.a.f();
        });
        this.i.setName("Stops&Icebergs On-Chart;showStopsNumber");
        this.j.addActionListener(actionEvent -> {
            e2.stopsShowHiddenIcons = this.j.isSelected();
            this.a.f();
            this.J.setEnabled(this.j.isSelected());
            this.K.setEnabled(this.j.isSelected());
        });
        this.j.setName("Stops&Icebergs On-Chart;stopsShowHiddenIcons");
        this.k.addActionListener(actionEvent -> {
            e2.stopsNotAggregated = this.k.isSelected();
            this.a.f();
            this.D.setEnabled(!this.k.isSelected());
            this.E.setEnabled(!this.k.isSelected());
            this.F.setEnabled(!this.k.isSelected());
            this.G.setEnabled(!this.k.isSelected());
        });
        this.k.setToolTipText("Disable icons aggregation");
        this.k.setName("Stops&Icebergs On-Chart;stopsNotAggregated");
        this.d.setModel(new SpinnerNumberModel(0, 0, Integer.MAX_VALUE, 1));
        velox.indicators.sionchart.a.t.a(this.d);
        this.d.addChangeListener(changeEvent -> {
            e2.stopsThreshold = (Integer)this.d.getValue();
            this.a.f();
        });
        this.d.setName("Stops&Icebergs On-Chart;stopsThresholdSize");
        this.e.setModel(new SpinnerNumberModel(0, 0, Integer.MAX_VALUE, 1));
        velox.indicators.sionchart.a.t.a(this.e);
        this.e.addChangeListener(changeEvent -> {
            e2.stopsAggThreshold = (Integer)this.e.getValue();
            this.a.f();
        });
        this.e.setName("Stops&Icebergs On-Chart;stopsAggThresholdSize");
        this.l.setLayout(new BoxLayout(this.l, 1));
        this.l.add(this.v);
        this.l.add(this.w);
        this.v.setAlignmentX(0.5f);
        this.w.addChangeListener(changeEvent -> {
            e2.stopsIconsHeight = this.w.getValue();
            this.v.setText(Integer.toString(this.w.getValue()));
            this.a.f();
            this.w.repaint();
        });
        this.w.setName("Stops&Icebergs On-Chart;stopsIconsSize");
        this.u.setLayout(new BoxLayout(this.u, 1));
        this.u.add(this.J);
        this.u.add(this.K);
        this.J.setAlignmentX(0.5f);
        this.K.addChangeListener(changeEvent -> {
            e2.stopsHiddenTransparency = this.K.getValue();
            this.J.setText(Integer.toString(this.K.getValue()));
            this.a.f();
            this.K.repaint();
        });
        this.K.setName("Stops&Icebergs On-Chart;stopsHiddenTransparency");
        this.n.setLayout(new BoxLayout(this.n, 1));
        this.n.add(this.z);
        this.n.add(this.A);
        this.z.setAlignmentX(0.5f);
        this.A.addChangeListener(changeEvent -> {
            e2.stopsOrderLineWidth = this.A.getValue();
            this.z.setText(Integer.toString(this.A.getValue()));
            this.a.f();
            this.A.repaint();
        });
        this.A.setName("Stops&Icebergs On-Chart;stopsOrderLineWidth");
        this.o.setLayout(new BoxLayout(this.o, 1));
        this.o.add(this.B);
        this.o.add(this.C);
        this.B.setAlignmentX(0.5f);
        this.C.addChangeListener(changeEvent -> {
            e2.stopsOffsetLineWidth = this.C.getValue();
            this.B.setText(Integer.toString(this.C.getValue()));
            this.a.f();
            this.C.repaint();
        });
        this.C.setName("Stops&Icebergs On-Chart;stopsOffsetLineWidth");
        this.m.setLayout(new BoxLayout(this.m, 1));
        this.m.add(this.x);
        this.m.add(this.y);
        this.x.setAlignmentX(0.5f);
        this.y.addChangeListener(changeEvent -> {
            e2.stopsIconsOffset = this.y.getValue();
            this.x.setText(Integer.toString(this.y.getValue()));
            this.a.f();
        });
        this.y.setName("Stops&Icebergs On-Chart;stopsIconsOffset");
        this.p.setLayout(new BoxLayout(this.p, 1));
        this.p.add(this.D);
        this.p.add(this.E);
        this.D.setAlignmentX(0.5f);
        this.E.addChangeListener(changeEvent -> {
            e2.stopsPriceAreaMultiplier = this.E.getValue();
            this.D.setText(Double.toString((double)this.E.getValue() / 10.0));
            this.a.f();
            this.E.repaint();
        });
        this.E.setName("Stops&Icebergs On-Chart;stopsPriceAreaMultiplier");
        this.q.setLayout(new BoxLayout(this.q, 1));
        this.q.add(this.F);
        this.q.add(this.G);
        this.F.setAlignmentX(0.5f);
        this.G.addChangeListener(changeEvent -> {
            e2.stopsTimeAreaMultiplier = this.G.getValue();
            this.F.setText(Double.toString((double)this.G.getValue() / 10.0));
            this.a.f();
            this.G.repaint();
        });
        this.G.setName("Stops&Icebergs On-Chart;stopsTimeAreaMultiplier");
        SpinnerNumberModel spinnerNumberModel = new SpinnerNumberModel(1, 1, 1440, 1);
        this.s.setModel(spinnerNumberModel);
        this.s.setToolTipText("Values range: " + spinnerNumberModel.getMinimum() + ".." + spinnerNumberModel.getMaximum());
        velox.indicators.sionchart.a.t.a(this.s);
        this.s.addChangeListener(changeEvent -> {
            e2.stopsSdInterval = (Integer)this.s.getValue();
            if (e2.stopsAutoThreshold) {
                this.a.a(true);
            }
            this.a.f();
        });
        this.s.setName("Stops&Icebergs On-Chart;stopsSdInterval");
        this.t.setLayout(new BoxLayout(this.t, 1));
        this.t.add(this.H);
        this.t.add(this.I);
        this.H.setAlignmentX(0.5f);
        this.I.addChangeListener(changeEvent -> {
            e2.stopsSdMultiplier = this.c();
            this.H.setText(Double.toString(this.c()));
            if (e2.stopsAutoThreshold) {
                this.a.a(true);
            }
            this.a.f();
        });
        this.I.setName("Stops&Icebergs On-Chart;stopsSdMultiplier");
        this.r.addActionListener(actionEvent -> {
            e2.stopsAutoThreshold = this.r.isSelected();
            this.d.setEnabled(!e2.stopsAutoThreshold);
            this.s.setEnabled(e2.stopsAutoThreshold);
            this.I.setEnabled(e2.stopsAutoThreshold);
            this.H.setEnabled(e2.stopsAutoThreshold);
            if (e2.stopsAutoThreshold) {
                this.a.a(true);
            }
            this.a.f();
        });
        this.r.setName("Stops&Icebergs On-Chart;stopsAutoThreshold");
    }

    void b() {
        e e2 = this.a.e();
        this.b.setColor(e2.stopsAskColor, true);
        this.c.setColor(e2.stopsBidColor, true);
        this.g.setSelected(e2.showStops);
        this.f.setSelected(e2.showOnlyStopsTBPL);
        this.h.setSelected(e2.showStopsTotals);
        this.i.setSelected(e2.showStopsNumber);
        this.j.setSelected(e2.stopsShowHiddenIcons);
        this.K.setEnabled(this.j.isSelected());
        this.J.setEnabled(this.j.isSelected());
        this.d.setValue(e2.stopsThreshold);
        this.e.setValue(e2.stopsAggThreshold);
        this.w.setValue(e2.stopsIconsHeight);
        this.v.setText(Integer.toString(this.w.getValue()));
        this.K.setValue(e2.stopsHiddenTransparency);
        this.J.setText(Integer.toString(this.K.getValue()));
        this.A.setValue(e2.stopsOrderLineWidth);
        this.z.setText(Integer.toString(this.A.getValue()));
        this.C.setValue(e2.stopsOffsetLineWidth);
        this.B.setText(Integer.toString(this.C.getValue()));
        this.y.setValue(e2.stopsIconsOffset);
        this.x.setText(Integer.toString(this.y.getValue()));
        this.E.setValue(e2.stopsPriceAreaMultiplier);
        this.D.setText(Double.toString((double)this.E.getValue() / 10.0));
        this.G.setValue(e2.stopsTimeAreaMultiplier);
        this.F.setText(Double.toString((double)this.G.getValue() / 10.0));
        this.s.setEnabled(e2.stopsAutoThreshold);
        this.s.setValue(e2.stopsSdInterval);
        this.a(e2.stopsSdMultiplier);
        this.H.setText(Double.toString(this.c()));
        this.r.setSelected(e2.stopsAutoThreshold);
        this.d.setEnabled(!e2.stopsAutoThreshold);
        this.s.setEnabled(e2.stopsAutoThreshold);
        this.I.setEnabled(e2.stopsAutoThreshold);
        this.H.setEnabled(e2.stopsAutoThreshold);
        this.k.setSelected(e2.stopsNotAggregated);
        this.D.setEnabled(!this.k.isSelected());
        this.E.setEnabled(!this.k.isSelected());
        this.F.setEnabled(!this.k.isSelected());
        this.G.setEnabled(!this.k.isSelected());
    }

    private double c() {
        return (double)this.I.getValue() / 10.0;
    }

    private void a(double d2) {
        this.I.setValue((int)(d2 * 10.0));
    }
}

