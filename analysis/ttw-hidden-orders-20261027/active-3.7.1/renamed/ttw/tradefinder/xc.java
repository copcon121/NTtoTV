/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Font;
import java.text.DecimalFormat;
import ttw.tradefinder.he_1;
import ttw.tradefinder.ie_0;
import ttw.tradefinder.jc;
import ttw.tradefinder.pe_1;

public class xc
extends jc {
    private static final int A = 6;
    private final DecimalFormat C;
    private static final int M = 14;
    private static final int b = 6;
    private static final int c = 2;

    @Override
    public void E(double a2) {
        xc a3;
        a3.E((float)(a2 * 14.0));
    }

    public void j(double a2) {
        xc a3;
        if (Double.isNaN(a2)) {
            a3.E(pe_1.E("rpr"));
            return;
        }
        xc xc2 = a3;
        xc2.E(xc2.C.format(a2));
    }

    public xc(DecimalFormat a2) {
        super(pe_1.E("rpr"), 6, 6, 2, 6, 0, 0, new Font(ie_0.E(" *\b9\r"), 1, 14), he_1.H);
        xc a3;
        a3.C = a2;
    }
}

