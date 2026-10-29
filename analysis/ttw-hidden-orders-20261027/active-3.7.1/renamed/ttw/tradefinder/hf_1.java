/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import ttw.tradefinder.sd_2;

/*
 * Renamed from ttw.tradefinder.hf
 */
public class hf_1 {
    private List<sd_2> c = Collections.synchronizedList(new ArrayList());

    public List<sd_2> E() {
        hf_1 a2;
        return a2.c;
    }

    public void E(sd_2 a2) {
        hf_1 a3;
        a3.c.add(a2);
        a2.E(a3);
    }

    public hf_1() {
        hf_1 a2;
    }
}

