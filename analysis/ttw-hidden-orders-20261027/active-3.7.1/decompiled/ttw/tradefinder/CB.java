/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Font;
import java.text.DecimalFormat;
import ttw.tradefinder.be_0;
import ttw.tradefinder.he_1;
import ttw.tradefinder.ie_0;
import ttw.tradefinder.jc;

public class CB
extends jc {
    private static final int M = 4;
    private static final int b = 10;
    private static final DecimalFormat c = new DecimalFormat(ie_0.E("BvB"));

    public CB(double a2, String a3) {
        a4(a2, a3, "");
        CB a4;
    }

    @Override
    public void E(double a2) {
        CB a3;
        a3.E((float)(a2 * 10.0));
    }

    public CB(double a2, String a3, String a4) {
        super(a3 + c.format(a2) + a4, 4, 4, 0, 0, new Font(be_0.E("|\u001bT\bQ"), 0, 10), he_1.H);
        CB a5;
    }
}

