/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.text.DecimalFormat;
import ttw.tradefinder.af_1;
import ttw.tradefinder.he_1;
import ttw.tradefinder.oa_1;

/*
 * Renamed from ttw.tradefinder.GA
 */
public class ga_1
extends oa_1 {
    private static final DecimalFormat c = new DecimalFormat(af_1.E("9{9"));

    public ga_1(double a2) {
        ga_1 a3;
        double d2;
        String string;
        if (a2 == Double.POSITIVE_INFINITY || a2 == Double.NEGATIVE_INFINITY) {
            string = af_1.E("\u2217");
            d2 = a2;
        } else {
            string = c.format(Math.abs(a2));
            d2 = a2;
        }
        super(string, d2 > 0.0 ? he_1.j : he_1.c);
    }
}

