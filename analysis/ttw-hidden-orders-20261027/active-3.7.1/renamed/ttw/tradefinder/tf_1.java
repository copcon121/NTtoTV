/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.K;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ed_2;
import ttw.tradefinder.f_0;
import ttw.tradefinder.g_0;
import ttw.tradefinder.jA;

/*
 * Renamed from ttw.tradefinder.tF
 */
public class tf_1
implements g_0 {
    public final /* synthetic */ ed_2 b;
    public final /* synthetic */ f_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ tf_1(ed_2 a2, f_0 a3) {
        tf_1 a4;
        a4.b = a2;
        a4.c = a3;
    }

    @Override
    public void E(K a2, boolean a3, boolean a4) {
        tf_1 a5;
        if (a3 && a4 && a5.b.M && a5.c.boolean_j()) {
            tf_1 tf_12 = a5;
            tf_12.b.M = false;
            a2 = tf_12.b.E();
            tf_12.b.j(a5.b.D.java_lang_String_E(), ((jA)((df_0)a2).M).M, a5.b.C.E(((jA)((df_0)a2).M).C));
        }
    }
}

