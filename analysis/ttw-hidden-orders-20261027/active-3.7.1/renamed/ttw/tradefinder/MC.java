/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.util.function.Consumer;
import ttw.tradefinder.Q;
import ttw.tradefinder.dB;

public class MC
implements Consumer<Color> {
    public final /* synthetic */ Q b;
    public final /* synthetic */ dB c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ MC(dB a2, Q a3) {
        MC a4;
        a4.c = a2;
        a4.b = a3;
    }

    public void E(Color a2) {
        MC a3;
        MC mC = a3;
        mC.b.E(a2);
        mC.c.c.repaint();
    }
}

