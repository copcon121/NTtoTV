/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.StrategyPanel
 */
package velox.indicators.sionchart;

import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.LayoutManager;
import javax.swing.JCheckBox;
import velox.gui.StrategyPanel;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.e;

public class m
extends StrategyPanel {
    JCheckBox a = new JCheckBox("Enable");
    SitIndicator b;

    public m(SitIndicator sitIndicator) {
        super("Events broadcasting", (LayoutManager)new GridBagLayout());
        this.b = sitIndicator;
        e e2 = sitIndicator.e();
        this.a.addActionListener(actionEvent -> {
            if (!this.a.isSelected()) {
                sitIndicator.b();
            }
            e2.enableBroadcasting = this.a.isSelected();
            sitIndicator.f();
            if (this.a.isSelected()) {
                sitIndicator.a();
            }
        });
        this.a.setName("Stops&Icebergs On-Chart;enableBroadcasting");
        this.a();
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        gridBagConstraints.insets = new Insets(4, 2, 4, 2);
        gridBagConstraints.fill = 2;
        gridBagConstraints.weightx = 1.0;
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 0;
        gridBagConstraints.anchor = 21;
        this.add(this.a, gridBagConstraints);
    }

    public void a() {
        e e2 = this.b.e();
        this.a.setSelected(e2.enableBroadcasting);
    }
}

