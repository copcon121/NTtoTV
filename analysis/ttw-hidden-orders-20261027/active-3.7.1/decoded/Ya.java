/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ae_1;
import ttw.tradefinder.eo;
import ttw.tradefinder.fg_0;
import ttw.tradefinder.wa_2;

public class Ya
extends wa_2<eo> {
    public static final String b = "XXXXXX-XXXXX-XXXXXX-XXXXX-XXXXXX";
    public String c = "XXXXXX-XXXXX-XXXXXX-XXXXX-XXXXXX";

    @Override
    public eo E() {
        Ya a2;
        eo eo2 = new eo();
        new eo().IsDefault = a2.b;
        eo2.b = a2.c;
        return eo2;
    }

    public Ya() {
        super(eo.class);
        Ya a2;
    }

    @Override
    public void E(eo a2) {
        eo eo2 = a2;
        a.b = (String)eo2.IsDefault;
        if (eo2.b != null) {
            a.c = a2.b;
        }
    }
}

