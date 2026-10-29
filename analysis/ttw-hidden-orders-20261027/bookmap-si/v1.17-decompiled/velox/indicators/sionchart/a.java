/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.StrategyPanel
 *  velox.gui.colors.ColorsConfigItem
 */
package velox.indicators.sionchart;

import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.io.Serializable;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import velox.gui.StrategyPanel;
import velox.gui.colors.ColorsConfigItem;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.a.k;
import velox.indicators.sionchart.e;

public class a {
    private final SitIndicator c;
    JCheckBox a = new JCheckBox("Show aggregation lines");
    ColorsConfigItem b;

    public a(SitIndicator sitIndicator) {
        this.c = sitIndicator;
        this.c();
        this.a();
    }

    private void c() {
        e e2 = this.c.e();
        this.a.addActionListener(actionEvent -> {
            e2.showAggregationLines = this.a.isSelected();
            this.c.f();
        });
        this.a.setName("Stops&Icebergs On-Chart;showAggregationLine");
        this.b = new ColorsConfigItem(e2.aggregationLineColor, e.AGGREGATION_LINE_DEFAULT_COLOR, color -> {
            e2.aggregationLineColor = color;
            this.c.f();
        });
        this.b.setName("Stops&Icebergs On-Chart;aggregationLineColorConfig");
    }

    public void a() {
        e e2 = this.c.e();
        this.a.setSelected(e2.showAggregationLines);
        this.b.setColor(e2.aggregationLineColor, true);
    }

    public StrategyPanel b() {
        JPanel jPanel = new JPanel();
        jPanel.setLayout(new GridBagLayout());
        jPanel.setVisible(false);
        Serializable serializable = new GridBagConstraints();
        ((GridBagConstraints)serializable).insets = new Insets(5, 5, 5, 5);
        ((GridBagConstraints)serializable).fill = 2;
        ((GridBagConstraints)serializable).weightx = 1.0;
        ((GridBagConstraints)serializable).gridx = 0;
        ((GridBagConstraints)serializable).gridy = 0;
        jPanel.add((Component)new JLabel("Line color"), serializable);
        ++((GridBagConstraints)serializable).gridx;
        ((GridBagConstraints)serializable).gridwidth = 0;
        jPanel.add((Component)this.b);
        serializable = new JPanel();
        ((Container)serializable).setLayout(new GridBagLayout());
        JButton jButton = new JButton();
        jButton.setIcon(SitIndicator.t);
        jButton.setPreferredSize(new Dimension(22, 22));
        jButton.addActionListener(actionEvent -> {
            boolean bl = !jPanel.isVisible();
            jPanel.setVisible(bl);
            if (bl) {
                jButton.setIcon(SitIndicator.u);
            } else {
                jButton.setIcon(SitIndicator.t);
            }
        });
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        gridBagConstraints.insets = new Insets(4, 2, 4, 2);
        gridBagConstraints.fill = 2;
        gridBagConstraints.weightx = 0.0;
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 0;
        ((Container)serializable).add(jButton, gridBagConstraints);
        gridBagConstraints.gridx = 1;
        gridBagConstraints.weightx = 1.0;
        gridBagConstraints.gridwidth = 0;
        ((Container)serializable).add(new k(this.a, "Show marks on the chart where data aggregation was applied"), gridBagConstraints);
        jButton = new StrategyPanel("Aggregation lines settings");
        jButton.setLayout(new BoxLayout(jButton, 1));
        jButton.add((Component)serializable);
        jButton.add(jPanel);
        return jButton;
    }
}

