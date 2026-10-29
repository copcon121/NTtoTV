/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.Layer1ApiInstrumentSpecificEnabledStateProvider
 */
package ttw.tradefinder;

import java.awt.Component;
import java.awt.Cursor;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import ttw.tradefinder.K;
import ttw.tradefinder.bb_2;
import ttw.tradefinder.bf_1;
import ttw.tradefinder.cd;
import ttw.tradefinder.df_0;
import ttw.tradefinder.eg_0;
import ttw.tradefinder.es;
import ttw.tradefinder.f_0;
import ttw.tradefinder.g_0;
import ttw.tradefinder.of_1;
import ttw.tradefinder.pe_1;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.zc_2;
import ttw.tradefinder.ze_2;
import velox.api.layer1.Layer1ApiInstrumentSpecificEnabledStateProvider;

/*
 * Renamed from ttw.tradefinder.fa
 */
public abstract class fa_2
implements f_0,
g_0,
Layer1ApiInstrumentSpecificEnabledStateProvider {
    private K A;
    private Map<String, Runnable> C;
    private boolean M;
    private df_0<bf_1, es> b;
    private boolean c;

    public fa_2() {
        fa_2 a2;
        fa_2 fa_22 = a2;
        fa_2 fa_23 = a2;
        a2.C = Collections.synchronizedMap(new HashMap());
        fa_23.b = null;
        fa_23.A = null;
        fa_22.c = false;
        fa_22.M = false;
    }

    public abstract boolean E(String var1, boolean var2);

    @Override
    public boolean isStrategyEnabled(String a2) {
        fa_2 a3;
        if (a3.b == null) {
            return false;
        }
        if (!a3.c && !a3.M) {
            return false;
        }
        return ((bf_1)a3.b.M).java_lang_Boolean_E(a2);
    }

    public /* synthetic */ void void_a() {
        fa_2 a2;
        fa_2 fa_22 = a2;
        a2.b = a2.E(fa_22.java_lang_String_E(), new bf_1());
        if (fa_22.A.boolean_E()) {
            for (String object : ((bf_1)a2.b.M).E()) {
                ze_2 ze_22 = a2.ttw_tradefinder_ze_2_E(object);
                if (ze_22 != null && a2.A.E(ze_22.j)) continue;
                a2.onStrategyCheckboxEnabled(object, false);
            }
            Iterator<Object> iterator = a2.C.values().iterator();
            Iterator<Object> iterator2 = iterator;
            while (iterator2.hasNext()) {
                Runnable runnable = (Runnable)iterator.next();
                runnable.run();
                iterator2 = iterator;
            }
        }
    }

    public /* synthetic */ void void_j() {
        fa_2 a2;
        fa_2 fa_22 = a2;
        fa_22.A.void_E();
        fa_22.C.clear();
    }

    @Override
    public List<String> E() {
        fa_2 a2;
        if (a2.b == null) {
            return Collections.emptyList();
        }
        if (!a2.c && !a2.M) {
            return Collections.emptyList();
        }
        return ((bf_1)a2.b.M).E();
    }

    public /* synthetic */ void E(r_0 a2, qc_1 a3, boolean a4) {
        fa_2 a5;
        fa_2 fa_22 = a5;
        r_0 r_02 = a2;
        a5.A = r_02.j(a3).E(a5);
        fa_22.c = r_02.boolean_E();
        fa_22.M = a4;
    }

    @Override
    public void E(K a2, boolean a32, boolean a42) {
        fa_2 a5;
        if (a5.b == null) {
            return;
        }
        if (a42) {
            a2 = ((bf_1)a5.b.M).E().iterator();
            while (a2.hasNext()) {
                String a32 = (String)a2.next();
                ze_2 a42 = a5.ttw_tradefinder_ze_2_E(a32);
                if (a42 != null && a5.A.E(a42.j)) continue;
                a5.onStrategyCheckboxEnabled(a32, false);
            }
            Iterator<Runnable> iterator = a2 = a5.C.values().iterator();
            while (iterator.hasNext()) {
                Runnable a32 = a2.next();
                a32.run();
                iterator = a2;
            }
        }
    }

    public void setStrategyEnabledRecheckCallback(String a2, Runnable a3) {
        fa_2 a4;
        a4.C.put(a2, a3);
    }

    public boolean boolean_a() {
        fa_2 a2;
        if (a2.b == null) {
            return false;
        }
        if (!a2.c && !a2.M) {
            return false;
        }
        return ((bf_1)a2.b.M).boolean_E();
    }

    /*
     * Unable to fully structure code
     */
    public void onStrategyCheckboxEnabled(String a, boolean a) {
        block6: {
            block8: {
                block9: {
                    block7: {
                        if (a.b == null) {
                            return;
                        }
                        if (!a) break block6;
                        var4_3 = a.ttw_tradefinder_ze_2_E(a);
                        var3_4 = new sc_1(a, "");
                        if (var4_3 != null) break block7;
                        var3_4.l(new JLabel("Please wait until the instrument \"" + a + "\" is successfully loaded."));
                        v0 = var3_4;
                        break block8;
                    }
                    if (a.c || a.M) break block9;
                    v1 = var3_4;
                    v0 = v1;
                    v1.l(new JLabel(pe_1.E("\u000b56.\u007f\t\u000b\n\u007f--2;(<)\u007f4,}033$\u007f<)<61>?38\u007f9*/638}\u0013\u0014\t\u0018\u007f.:.,403q")));
                    break block8;
                }
                if (a.A.E(var4_3.j)) ** GOTO lbl53
                var4_3 = a.A.E(var4_3.j);
                if (var4_3.size() > 0) {
                    var3_4.l(new JLabel(bb_2.E("\u000510<&8u- /654.0}:30}:;u)=8u;:192\"4;:u. ?&>'4%)<2;.o")));
                    var4_3 = var4_3.iterator();
                    v2 = var4_3;
                    while (v2.hasNext()) {
                        var5_5 = (cd)var4_3.next();
                        var6_6 = new JLabel("<html><a href=\"\" style=\"color: white\">" + zc_2.E(var5_5) + "</a></html>");
                        var6_6.setCursor(Cursor.getPredefinedCursor(12));
                        v2 = var4_3;
                        v3 = var6_6;
                        v3.addMouseListener(new eg_0(a, var5_5));
                        var3_4.l(v3);
                    }
                    v4 = var3_4;
                    v0 = v4;
                    v4.l(new JLabel(pe_1.E("\u00149}+5:}\u000b\t\b}//09*>+}7<,}=8:3\u007f<3/:<;$\u007f<<)6+>):9s")));
                    var3_4.l(new JLabel(bb_2.E("-984.0}\"<<)u<u;0*u.0>:31.u):}#8'43$u$:('}&(7.6/<-!4:3{")));
                } else {
                    var3_4.l(new JLabel(a.java_lang_String_E() + " is not supported for instruments without MBO data."));
                    var3_4.l(new JLabel(pe_1.E("\u00192-}22-8\u007f41;0/2<+403s}/1:<,8\u007f+6.6)e")));
                    var4_3 = new JLabel(bb_2.E("a=)81ka4}=/0;h\u007fw}&),10`w>:1:/o}\"5<)0\u007fk\u00104/>8!}7$u\u0012'90/uu\u0018\u001f\u001atupu\u001e\u0018\u0018u\u001a'2 -ir4cir=)81k"));
                    var4_3.setCursor(Cursor.getPredefinedCursor(12));
                    v5 = var4_3;
                    v5.addMouseListener(new of_1(a));
                    var3_4.l((Component)v5);
lbl53:
                    // 2 sources

                    v0 = var3_4;
                }
            }
            if (!v0.boolean_j()) {
                JOptionPane.showMessageDialog(new JFrame(), var3_4, pe_1.E("\u001c<)6+>)621}12+}>132(8;"), 1);
                return;
            }
        }
        if (a != ((bf_1)a.b.M).java_lang_Boolean_E(a)) {
            ((bf_1)a.b.M).E(a, a);
            v6 = a;
            v6.E(v6.java_lang_String_E(), a.b);
            v6.E(a, a);
        }
    }
}

