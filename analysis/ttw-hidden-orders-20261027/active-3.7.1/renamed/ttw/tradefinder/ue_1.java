/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.StrategyPanel
 */
package ttw.tradefinder;

import java.awt.Component;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.LayoutManager;
import ttw.tradefinder.lf_2;
import ttw.tradefinder.sc_1;
import velox.gui.StrategyPanel;

/*
 * Renamed from ttw.tradefinder.UE
 */
public class ue_1
extends StrategyPanel {
    private final sc_1 b;
    public static final long c = 7484950694675698376L;

    public ue_1(sc_1 a2) {
        ue_1 a3;
        ue_1 ue_12 = a3;
        super(null);
        ue_12.b = a2;
        super.setLayout((LayoutManager)new GridBagLayout());
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().anchor = 19;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints3.fill = 2;
        gridBagConstraints3.gridx = 1;
        gridBagConstraints2.gridy = 0;
        gridBagConstraints2.weightx = 1.0;
        if (a2.m == null) {
            super.add((Component)a2, (Object)gridBagConstraints);
            return;
        }
        a2 = new lf_2((sc_1)a2);
        super.add((Component)a2, (Object)gridBagConstraints);
    }

    public boolean E(sc_1 a2) {
        ue_1 a3;
        return a3.b == a2;
    }
}

