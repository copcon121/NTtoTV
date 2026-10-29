/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.im;
import ttw.tradefinder.wa_2;

public class LC
extends wa_2<im> {
    public int C;
    public boolean M;
    public int c;

    public LC() {
        LC a2;
        LC lC = a2;
        super(im.class);
        a2.M = false;
        lC.C = 50;
        lC.c = 40;
    }

    @Override
    public im E() {
        LC a2;
        im im2 = new im();
        new im().IsDefault = a2.b;
        LC lC = a2;
        im2.b = lC.M;
        im2.c = lC.C;
        im2.d = a2.c;
        return im2;
    }

    @Override
    public void E(im a2) {
        LC a3;
        LC lC = a3;
        im im2 = a2;
        a3.b = a2.IsDefault;
        a3.M = im2.b;
        lC.C = im2.c;
        lC.c = a2.d;
    }
}

