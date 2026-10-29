/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.util.function.Consumer;
import javax.swing.ImageIcon;
import ttw.tradefinder.ca_1;
import ttw.tradefinder.cb_0;
import ttw.tradefinder.ta_1;
import ttw.tradefinder.z;

/*
 * Renamed from ttw.tradefinder.lC
 */
public class lc_1
implements Consumer<Color> {
    public final /* synthetic */ z b;
    public final /* synthetic */ ta_1 c;

    public void E(Color a2) {
        lc_1 a3;
        lc_1 lc_12 = a3;
        lc_12.b.a(a2);
        lc_12.c.M.setIcon(new ImageIcon(cb_0.E(new ca_1(a3.b))));
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ lc_1(ta_1 a2, z a3) {
        lc_1 a4;
        a4.c = a2;
        a4.b = a3;
    }
}

