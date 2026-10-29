/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.indicators.AliasFilter
 */
package ttw.tradefinder;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import velox.api.layer1.messages.indicators.AliasFilter;

/*
 * Renamed from ttw.tradefinder.jD
 */
public class jd_2
implements AliasFilter {
    private final Set<String> c;

    public jd_2() {
        a2(Collections.emptyList());
        jd_2 a2;
    }

    public jd_2(List<String> a2) {
        jd_2 a3;
        jd_2 jd_22 = a3;
        jd_22.c = new HashSet<String>();
        jd_22.c.clear();
        jd_22.c.addAll(a2);
    }

    public boolean isDisplayedForAlias(String a2) {
        jd_2 a3;
        return a3.c.contains(a2);
    }
}

