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

public class Gb
implements Consumer<Color> {
    public final /* synthetic */ ta_1 b;
    public final /* synthetic */ z c;

    public void E(Color a2) {
        Gb a3;
        Gb gb = a3;
        gb.c.j(a2);
        gb.b.M.setIcon(new ImageIcon(cb_0.E(new ca_1(a3.c))));
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Gb(ta_1 a2, z a3) {
        Gb a4;
        a4.b = a2;
        a4.c = a3;
    }
}

