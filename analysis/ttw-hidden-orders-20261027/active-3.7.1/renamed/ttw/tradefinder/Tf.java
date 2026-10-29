/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import ttw.tradefinder.EB;
import ttw.tradefinder.af_0;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.eb_0;
import ttw.tradefinder.ec_0;
import ttw.tradefinder.ff_0;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.he_1;
import ttw.tradefinder.qd_2;
import ttw.tradefinder.qe_0;
import ttw.tradefinder.te_0;
import ttw.tradefinder.vC;
import ttw.tradefinder.ze_2;

public class Tf {
    private static final DecimalFormat c = new DecimalFormat(te_0.E("\u0018f\u0018"));

    public static /* synthetic */ String java_lang_String_E(ze_2 a2, qe_0 a3) {
        String string = a3.boolean_E() ? ff_0.E("5\u0000*\t") : te_0.E("y\u001db");
        return String.format(ff_0.E("\u0013)\t3\b#e5\u0015/\u000e#eC6Je0\u007fF`\u0015jC6Je6\u007fF`\u0015iF\u0017\\eC6F$\u0012eC6"), string, a2.java_lang_String_E(a3.a()), a2.java_lang_String_E(a3.double_j()), Integer.toString(a3.int_j()), c.format(a3.double_E()), a2.java_lang_String_j(a3.int_E()));
    }

    public static /* synthetic */ Map<String, String> E(ze_2 a2, qe_0 a3) {
        HashMap<String, String> hashMap = new HashMap<String, String>();
        hashMap.put(ff_0.E("67\u000f&\u0003e%-\u0007+\u0001 "), Integer.toString(a3.int_j()));
        hashMap.put(te_0.E("\u001eT$N%^"), a2.java_lang_String_E(a3.a()) + " sell, " + a2.java_lang_String_E(a3.double_j()) + " buy");
        hashMap.put(ff_0.E("\u0017\u00071\u000f*"), c.format(a3.double_E()));
        hashMap.put(te_0.E("k:R+^"), a2.java_lang_String_j(a3.int_E()));
        return hashMap;
    }

    public static /* synthetic */ qd_2 E(ze_2 a2, gf_2 a3, qe_0 a4) {
        String string = a4.boolean_E() ? te_0.E("h-W$\u001b\u001eT$N%^hh8R#^") : ff_0.E("$0\u001fe0*\n0\u000b F\u0016\u0016,\r ");
        qe_0 qe_02 = a4;
        String string2 = a2.java_lang_String_E(a4.boolean_E() ? qe_02.a() : qe_02.double_j());
        return a3.E(a2.D, string, string2, a2.java_lang_String_j(a4.int_E()), a4.boolean_E());
    }

    public static /* synthetic */ cc_0 ttw_tradefinder_cc_0_E(ze_2 a2, qe_0 a3) {
        String string = a3.boolean_E() ? ff_0.E("5 \n)F\u0013K\u0016\u0016,\r ") : te_0.E("y=Bhmeh8R#^");
        double d2 = a3.double_E();
        Color color = d2 == Double.POSITIVE_INFINITY || d2 == Double.NEGATIVE_INFINITY ? he_1.A : null;
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0(ff_0.E("6\u007f"), new ec_0(Integer.toString(a3.int_j()))));
        arrayList.add(new eb_0(te_0.E("\u001a\u0001"), new vC(d2)));
        return new cc_0(string, a2.java_lang_String_j(a3.int_E()), af_0.K, new EB(a2.java_lang_String_E(a3.double_j()), a2.java_lang_String_E(a3.a())), arrayList, color);
    }

    public /* synthetic */ Tf() {
        Tf a2;
    }
}

