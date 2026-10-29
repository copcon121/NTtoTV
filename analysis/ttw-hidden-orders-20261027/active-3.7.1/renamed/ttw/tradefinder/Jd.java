/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ae_1;
import ttw.tradefinder.ff_0;

public class Jd {
    private final String M;
    private final float b;
    private final String c;

    public String java_lang_String_j() {
        Jd a2;
        return a2.c;
    }

    public Jd(String a2, String a3, float a4) {
        Jd a5;
        Jd jd = a5;
        jd.M = a3;
        jd.b = a4;
        if (!a2.isEmpty()) {
            a5.c = "at " + a2;
            return;
        }
        a5.c = "";
    }

    public static Jd ttw_tradefinder_Jd_j() {
        return new Jd("", "", 1.0f);
    }

    public String toString() {
        Jd a2;
        if (!a2.M.isEmpty()) {
            if (!a2.c.isEmpty()) {
                Jd jd = a2;
                return jd.M + jd.c;
            }
            return a2.M;
        }
        if (!a2.c.isEmpty()) {
            return a2.c;
        }
        return ae_1.E("DiQpX");
    }

    public static Jd ttw_tradefinder_Jd_E() {
        return new Jd(ae_1.E("\u00190\u0017*\u0015"), ff_0.E("WvQp"), 2.0f);
    }

    public boolean E(boolean a2) {
        Jd a3;
        return a3.M.isEmpty() && (!a2 || a3.c.isEmpty());
    }

    public String java_lang_String_E() {
        Jd a2;
        return a2.M;
    }

    public float float_E() {
        Jd a2;
        return a2.b;
    }
}

