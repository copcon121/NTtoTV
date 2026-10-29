/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.ArrayList;
import ttw.tradefinder.qa_2;

public class td
extends ArrayList<qa_2> {
    private int b;
    private int c;

    public td() {
        td a2;
        td td2 = a2;
        td2.c = 0;
        td2.b = 0;
    }

    public boolean E(qa_2 a2) {
        td a3;
        td td2 = a3;
        td2.c = Math.max(td2.c, a2.j());
        td2.b += a2.E();
        super.add(a2);
        return true;
    }

    public int j() {
        td a2;
        return a2.c;
    }

    public int E() {
        td a2;
        return a2.b;
    }
}

