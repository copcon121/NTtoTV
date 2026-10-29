/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Component;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import javax.swing.JPanel;
import ttw.tradefinder.ge_1;
import ttw.tradefinder.jf_2;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.sf_2;
import ttw.tradefinder.te_2;

/*
 * Renamed from ttw.tradefinder.LF
 */
public class lf_2
extends JPanel {
    public static final long c = 7484950694675698376L;

    public lf_2(sc_1 a2) {
        lf_2 a3;
        lf_2 lf_22 = a3;
        super(null);
        super.setLayout(new GridBagLayout());
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        new GridBagConstraints().anchor = 19;
        GridBagConstraints gridBagConstraints2 = gridBagConstraints;
        GridBagConstraints gridBagConstraints3 = gridBagConstraints;
        gridBagConstraints3.fill = 2;
        gridBagConstraints3.gridx = 1;
        gridBagConstraints2.gridy = 0;
        gridBagConstraints2.weightx = 1.0;
        if (a2.m == null) {
            super.add((Component)a2, gridBagConstraints);
            return;
        }
        sc_1 sc_12 = a2;
        boolean bl = sc_12.A();
        te_2 te_22 = new te_2(a2.m, Color.decode(ge_1.E("_>M?>0E")), bl);
        lf_2 lf_23 = a3;
        super.setBorder(te_22);
        super.add((Component)a2, gridBagConstraints);
        sc_12.E(new sf_2(a3, te_22));
        if (!bl) {
            return;
        }
        te_22.E(a2.d());
        lf_2 lf_24 = a3;
        super.addMouseListener(new jf_2(lf_24, te_22, a2));
    }
}

