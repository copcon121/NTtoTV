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
        return ((bf_1)a3.b.M).E(a2);
    }

    public /* synthetic */ void a() {
        fa_2 a2;
        fa_2 fa_22 = a2;
        a2.b = a2.E(fa_22.E(), new bf_1());
        if (fa_22.A.E()) {
            for (String object : ((bf_1)a2.b.M).E()) {
                ze_2 ze_22 = a2.E(object);
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

    public /* synthetic */ void j() {
        fa_2 a2;
        fa_2 fa_22 = a2;
        fa_22.A.E();
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
        fa_22.c = r_02.E();
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
                ze_2 a42 = a5.E(a32);
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

    public boolean a() {
        fa_2 a2;
        if (a2.b == null) {
            return false;
        }
        if (!a2.c && !a2.M) {
            return false;
        }
        return ((bf_1)a2.b.M).E();
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
                        var4_3 = a.E(a);
                        var3_4 = new sc_1(a, "");
                        if (var4_3 != null) break block7;
                        var3_4.l(new JLabel("Please wait until the instrument \"" + a + "\" is successfully loaded."));
                        v0 = var3_4;
                        break block8;
                    }
                    if (a.c || a.M) break block9;
                    v1 = var3_4;
                    v0 = v1;
                    v1.l(new JLabel("This TTW product is only available during LIVE session."));
                    break block8;
                }
                if (a.A.E(var4_3.j)) ** GOTO lbl53
                var4_3 = a.A.E(var4_3.j);
                if (var4_3.size() > 0) {
                    var3_4.l(new JLabel("Please purchase one of the following subscriptions:"));
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
                    v4.l(new JLabel("If the TTW product has been already activated,"));
                    var3_4.l(new JLabel("please wait a few seconds to verify your subscription."));
                } else {
                    var3_4.l(new JLabel(a.E() + " is not supported for instruments without MBO data."));
                    var3_4.l(new JLabel("For more information, please visit:"));
                    var4_3 = new JLabel("<html><a href=\"\" style=\"color: white\">Market by Order (MBO) - CME Group</a></html>");
                    var4_3.setCursor(Cursor.getPredefinedCursor(12));
                    v5 = var4_3;
                    v5.addMouseListener(new of_1(a));
                    var3_4.l((Component)v5);
lbl53:
                    // 2 sources

                    v0 = var3_4;
                }
            }
            if (!v0.j()) {
                JOptionPane.showMessageDialog(new JFrame(), var3_4, "Activation not allowed", 1);
                return;
            }
        }
        if (a != ((bf_1)a.b.M).E(a)) {
            ((bf_1)a.b.M).E(a, a);
            v6 = a;
            v6.E(v6.E(), a.b);
            v6.E(a, a);
        }
    }
}

