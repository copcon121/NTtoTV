/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Font;
import java.text.DecimalFormat;
import ttw.tradefinder.Oc;
import ttw.tradefinder.bb_0;
import ttw.tradefinder.ed;
import ttw.tradefinder.he_1;
import ttw.tradefinder.pe_1;

public class rb
extends bb_0 {
    private static final int A = 4;
    private static final int C = 11;
    private static final int M = 6;
    private final DecimalFormat b;
    private final ed c;

    @Override
    public void E(double a2) {
        rb a3;
        a3.E((float)(a2 * 11.0));
    }

    public void E(double a2, double a3) {
        rb a4;
        if (Double.isNaN(a2)) {
            rb rb2 = a4;
            rb2.E("---");
            rb2.c.E(0.0);
            return;
        }
        rb rb3 = a4;
        rb3.E(rb3.b.format(a2));
        rb3.c.E(a3);
    }

    public rb(DecimalFormat a2, ed a3) {
        super("---", 6, 6, 4, 1, 0, 0, new Font("Arial", 0, 11), he_1.H, a3);
        rb a4;
        a4.c = a3;
        a4.c.E(he_1.D);
        a4.b = a2;
    }
}

