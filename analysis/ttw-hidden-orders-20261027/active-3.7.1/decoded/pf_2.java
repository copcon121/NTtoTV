/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.indicators.AliasFilter
 */
package ttw.tradefinder;

import velox.api.layer1.messages.indicators.AliasFilter;

/*
 * Renamed from ttw.tradefinder.pF
 */
public class pf_2
implements AliasFilter {
    private final String c;

    public pf_2(String a2) {
        pf_2 a3;
        a3.c = a2;
    }

    public boolean isDisplayedForAlias(String a2) {
        pf_2 a3;
        return a3.c.equals(a2);
    }

    public pf_2() {
        a2("");
        pf_2 a2;
    }
}

