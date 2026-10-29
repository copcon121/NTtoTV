/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.function.Consumer;
import ttw.tradefinder.lf_2;
import ttw.tradefinder.te_2;

/*
 * Renamed from ttw.tradefinder.Sf
 */
public class sf_2
implements Consumer<String> {
    public final /* synthetic */ te_2 b;
    public final /* synthetic */ lf_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ sf_2(lf_2 a2, te_2 a3) {
        sf_2 a4;
        a4.c = a2;
        a4.b = a3;
    }

    public void E(String a2) {
        sf_2 a3;
        sf_2 sf_22 = a3;
        sf_22.b.E(a2);
        sf_22.c.repaint();
        sf_22.c.revalidate();
    }
}

