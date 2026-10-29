/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Font;
import ttw.tradefinder.be_0;
import ttw.tradefinder.he_1;
import ttw.tradefinder.jc;

/*
 * Renamed from ttw.tradefinder.HA
 */
public class ha_1
extends jc {
    private static final int C = 2;
    private static final int M = 2;
    private static final int b = 6;
    private static final int c = 10;

    public ha_1(String a2) {
        super(a2.toUpperCase(), 6, 2, 2, 0, 0, new Font("Arial", 0, 10), he_1.H);
        ha_1 a3;
    }

    @Override
    public void E(double a2) {
        ha_1 a3;
        a3.E((float)(a2 * 10.0));
    }
}

