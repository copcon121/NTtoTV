/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.gf_2;
import ttw.tradefinder.ja_1;
import ttw.tradefinder.q_0;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;

/*
 * Duplicate member names - consider using --renamedupmembers true
 */
public class NF
implements ja_1 {
    public final /* synthetic */ gf_2 b;
    public final /* synthetic */ q_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ NF(gf_2 a2, q_0 a3) {
        NF a4;
        a4.b = a2;
        a4.c = a3;
    }

    @Override
    public void E(rd_2 a2) {
        NF a3;
        if (!a3.b.C.equals((Object)a2)) {
            a3.b.C = a2;
            a3.c.E();
        }
    }

    @Override
    public rd_2 E() {
        NF a2;
        return a2.b.C;
    }

    @Override
    public String j() {
        NF a2;
        return a2.c.E(false);
    }

    @Override
    public boolean E() {
        NF a2;
        return a2.b.b;
    }

    @Override
    public void E() {
        NF a2;
        a2.c.j();
    }

    @Override
    public void E(te_1 a2) {
        NF a3;
        if (!a3.b.A.equals((Object)a2)) {
            a3.b.A = a2;
            a3.c.E();
        }
    }

    @Override
    public String E() {
        NF a2;
        return a2.b.c;
    }

    @Override
    public te_1 E() {
        NF a2;
        return a2.b.A;
    }

    @Override
    public String a() {
        NF a2;
        return a2.b.M;
    }

    @Override
    public void E(String a2) {
        NF a3;
        if (!a3.b.c.equals(a2)) {
            a3.b.c = a2;
            a3.c.E();
        }
    }

    @Override
    public String d() {
        NF a2;
        return a2.c.E(true);
    }

    @Override
    public void E(boolean a2) {
        NF a3;
        if (a3.b.b != a2) {
            a3.b.b = a2;
            a3.c.E();
        }
    }

    @Override
    public void j(String a2) {
        NF a3;
        if (!a3.b.M.equals(a2)) {
            a3.b.M = a2;
            a3.c.E();
        }
    }
}

