/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ei;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.xf_0;
import ttw.tradefinder.ze_2;

public class jA
extends wa_2<ei> {
    public String C;
    public String M;
    public static final String b;
    public static final String c;

    @Override
    public ei E() {
        jA a2;
        ei ei2 = new ei();
        new ei().IsDefault = a2.b;
        ei2.b = a2.M;
        ei2.c = a2.C;
        return ei2;
    }

    @Override
    public void E(ei a2) {
        ei ei2 = a2;
        a.b = (String)ei2.IsDefault;
        if (ei2.b != null) {
            a.M = a2.b;
        }
        if (a2.c != null) {
            a.C = a2.c;
        }
    }

    static {
        c = "123456789";
        b = ze_2.E((Object)"\u0004\u0007\u0006\u0001\u0000\u0003\u0002\r\f\u0005\u000fmmmmmmmmmmmmmjmmmmm\u0018mmmm\u0018mmmmmmmmmm");
    }

    public jA() {
        jA a2;
        jA jA2 = a2;
        super(ei.class);
        jA2.M = "123456789";
        jA2.C = ze_2.E((Object)"\u0004\u0007\u0006\u0001\u0000\u0003\u0002\r\f\u0005\u000fmmmmmmmmmmmmmjmmmmm\u0018mmmm\u0018mmmmmmmmmm");
    }
}

