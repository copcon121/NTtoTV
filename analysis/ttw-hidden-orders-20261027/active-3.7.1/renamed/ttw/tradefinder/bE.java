/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.TreeMap;
import ttw.tradefinder.be_0;

public class bE
extends TreeMap<Long, be_0> {
    private be_0 b = new be_0();
    private long c = 0L;

    public void E(long a2, int a3, double a4) {
        bE a5;
        if (a2 > a5.c) {
            a5.c = a2;
            a5.b = new be_0(a3, a4);
            a5.put(a2, a5.b);
            return;
        }
        a5.b.E(a4);
    }

    public void E() {
        bE a2;
        a2.clear();
        a2.c = 0L;
        a2.b = new be_0();
    }

    public bE() {
        bE a2;
    }
}

