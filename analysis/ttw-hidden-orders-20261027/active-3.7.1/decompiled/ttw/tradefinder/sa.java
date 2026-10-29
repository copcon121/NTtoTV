/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.df_1;
import ttw.tradefinder.j;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

public class sa
extends wa_2<j> {
    public df_1 c = df_1.c;

    @Override
    public j E() {
        sa a2;
        j j2 = new j();
        new j().IsDefault = a2.b;
        j2.a = va.E(a2.c);
        return j2;
    }

    public sa() {
        super(j.class);
        sa a2;
    }

    @Override
    public void E(j a2) {
        j j2 = a2;
        a.b = j2.IsDefault;
        if (j2.a != null) {
            a.c = va.E(a2.a);
        }
    }
}

