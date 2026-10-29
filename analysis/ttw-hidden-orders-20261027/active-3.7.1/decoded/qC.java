/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Font;
import java.text.DecimalFormat;
import ttw.tradefinder.Oc;
import ttw.tradefinder.he_1;
import ttw.tradefinder.jc;
import ttw.tradefinder.te_0;

public class qC
extends jc {
    private static final int M = 11;
    private static final DecimalFormat b = new DecimalFormat("0.0");
    private static final int c = 4;

    public qC(double a2) {
        super("R: " + (a2 == Double.POSITIVE_INFINITY || a2 == Double.NEGATIVE_INFINITY ? "\u221e" : b.format(Math.abs(a2))), 4, 4, 0, 0, new Font("Arial", 0, 11), a2 > 0.0 ? he_1.j : he_1.c);
        qC a3;
    }

    @Override
    public void E(double a2) {
        qC a3;
        a3.E((float)(a2 * 11.0));
    }
}

