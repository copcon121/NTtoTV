/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.Layer1ApiProvider
 *  velox.api.layer1.data.TradeInfo
 *  velox.api.layer1.layers.strategies.interfaces.CustomGeneratedEventAliased
 *  velox.api.layer1.messages.indicators.StrategyUpdateGenerator
 *  velox.api.layer1.messages.indicators.StrategyUpdateGeneratorFilter
 *  velox.api.layer1.messages.indicators.StrategyUpdateGeneratorFilter$StrategyUpdateGeneratorEventType
 *  velox.api.layer1.utils.IdHelper
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.function.Consumer;
import ttw.tradefinder.cd_2;
import ttw.tradefinder.ee_0;
import ttw.tradefinder.x_0;
import ttw.tradefinder.yd;
import ttw.tradefinder.ze_2;
import velox.api.layer1.Layer1ApiProvider;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.layers.strategies.interfaces.CustomGeneratedEventAliased;
import velox.api.layer1.messages.indicators.StrategyUpdateGenerator;
import velox.api.layer1.messages.indicators.StrategyUpdateGeneratorFilter;
import velox.api.layer1.utils.IdHelper;

/*
 * Renamed from ttw.tradefinder.xf
 */
public class xf_2
implements StrategyUpdateGenerator,
StrategyUpdateGeneratorFilter {
    private boolean B;
    private final String K;
    private final Object E;
    private boolean j;
    private List<yd> a;
    private final String h;
    private final ee_0 H;
    private boolean D;
    private long A;
    private final Layer1ApiProvider C;
    private final Set<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> M;
    private long b;
    private Consumer<CustomGeneratedEventAliased> c;

    public void j(String a2, x_0 a3) {
        xf_2 a4;
        if (!((String)a2).equals(a4.h)) {
            return;
        }
        a2 = a4.E;
        synchronized (a2) {
            Iterator<yd> iterator = a4.a.iterator();
            while (iterator.hasNext()) {
                yd yd2 = iterator.next();
                if (!yd2.E(a3)) continue;
                yd2.j();
                iterator.remove();
            }
            return;
        }
    }

    public void setGeneratedEventsConsumer(Consumer<CustomGeneratedEventAliased> a2) {
        a.c = a2;
    }

    public ee_0 ttw_tradefinder_ee_0_E() {
        xf_2 a2;
        return a2.H;
    }

    private /* synthetic */ boolean boolean_E(String a2) {
        xf_2 a3;
        if (!a3.j) {
            return false;
        }
        return a3.h.equals(a2);
    }

    public boolean boolean_E() {
        xf_2 a2;
        Object object = a2.E;
        synchronized (object) {
            Object object2;
            boolean bl;
            Iterator<yd> iterator = a2.a.iterator();
            while (iterator.hasNext()) {
                yd yd2 = iterator.next();
                if (!yd2.boolean_E()) continue;
                yd2.j();
                iterator.remove();
            }
            if (a2.a.size() > 0) {
                bl = true;
                object2 = object;
            } else {
                bl = false;
                object2 = object;
            }
            // ** MonitorExit[v1] (shouldn't be in output)
            return bl;
        }
    }

    public void void_E(String a2) {
        xf_2 a3;
        if (!((String)a2).equals(a3.h)) {
            return;
        }
        a2 = a3.E;
        synchronized (a2) {
            Iterator<yd> iterator;
            Iterator<yd> iterator2 = iterator = a3.a.iterator();
            while (iterator2.hasNext()) {
                iterator.next().j();
                iterator2 = iterator;
            }
            a3.a.clear();
            return;
        }
    }

    public void onTrade(String a22, double a32, int a4, TradeInfo a5) {
        xf_2 a6;
        if (!a6.boolean_E(a22)) {
            return;
        }
        int a22 = (int)(a32 + 0.5);
        if (a22 <= 0) {
            return;
        }
        Object a32 = a6.E;
        synchronized (a32) {
            Iterator<yd> iterator;
            Iterator<yd> iterator2 = iterator = a6.a.iterator();
            while (iterator2.hasNext()) {
                iterator.next().E(a6.b, a22, a4, a5);
                iterator2 = iterator;
            }
            return;
        }
    }

    public void E(String a2, x_0 a3) {
        xf_2 a4;
        if (!((String)a2).equals(a4.h)) {
            return;
        }
        a2 = new yd(a3);
        Object object = a4.E;
        synchronized (object) {
            a4.a.add((yd)a2);
        }
        if (a4.D) {
            a3.a();
        }
    }

    public void onMboCancel(String a2, String a3) {
        xf_2 a4;
        if (!a4.boolean_E((String)a2)) {
            return;
        }
        a2 = a4.E;
        synchronized (a2) {
            Iterator<yd> iterator;
            Iterator<yd> iterator2 = iterator = a4.a.iterator();
            while (iterator2.hasNext()) {
                iterator.next().E(a4.b, a3);
                iterator2 = iterator;
            }
            return;
        }
    }

    public void onMboSend(String a2, String a3, boolean a4, int a5, int a6) {
        xf_2 a7;
        if (!a7.boolean_E((String)a2)) {
            return;
        }
        if (a5 <= 0) {
            return;
        }
        a2 = a7.E;
        synchronized (a2) {
            Iterator<yd> iterator;
            Iterator<yd> iterator2 = iterator = a7.a.iterator();
            while (iterator2.hasNext()) {
                iterator.next().E(a7.b, a3, a5, a6, a4);
                iterator2 = iterator;
            }
            return;
        }
    }

    public xf_2(ze_2 a2, Layer1ApiProvider a3, Set<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> a4) {
        xf_2 a5;
        xf_2 xf_22 = a5;
        xf_2 xf_23 = a5;
        xf_2 xf_24 = a5;
        xf_2 xf_25 = a5;
        xf_2 xf_26 = a5;
        xf_2 xf_27 = a5;
        a5.E = new Object();
        xf_27.b = 0L;
        xf_27.A = 0L;
        xf_26.D = false;
        xf_26.B = false;
        xf_25.c = null;
        xf_24.j = true;
        xf_25.a = new ArrayList<yd>();
        xf_24.K = IdHelper.generateShortUuid();
        xf_23.M = a4;
        xf_23.h = a2.M;
        xf_22.C = a3;
        xf_22.H = new ee_0(a2);
        xf_22.j = true;
    }

    public void setTime(long a2) {
        Iterator<yd> iterator;
        xf_2 a3;
        if (!a3.j) {
            return;
        }
        a3.b = a2;
        if (a2 < a3.A) {
            return;
        }
        a3.A = a2 + cd_2.M;
        Object object = a3.E;
        synchronized (object) {
            Iterator<yd> iterator2 = iterator = a3.a.iterator();
            while (iterator2.hasNext()) {
                iterator.next().E(a2);
                iterator2 = iterator;
            }
        }
        if (!a3.D) {
            xf_2 xf_22;
            if (a3.B) {
                a3.D = true;
                object = a3.E;
                synchronized (object) {
                    iterator = a3.a.iterator();
                    Iterator<yd> iterator3 = iterator;
                    while (iterator3.hasNext()) {
                        iterator.next().void_E();
                        iterator3 = iterator;
                    }
                    // MONITOREXIT @DISABLED, blocks:[1, 3, 10, 11] lbl34 : MonitorExitStatement: MONITOREXIT : var3_4
                    xf_22 = a3;
                }
            } else {
                xf_22 = a3;
            }
            if (!xf_22.B && a2 >= a3.C.getCurrentTime()) {
                a3.B = true;
            }
        }
    }

    public void onUserMessage(Object a2) {
    }

    public Set<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> getGeneratorUpdateTypes() {
        xf_2 a2;
        return a2.M;
    }

    public Set<String> getGeneratorAliases() {
        xf_2 a2;
        return Collections.singleton(a2.java_lang_String_E());
    }

    public void void_j() {
        xf_2 a2;
        xf_2 xf_22 = a2;
        a2.j = false;
        xf_22.void_E();
        xf_22.c = null;
        xf_22.H.void_E();
    }

    public Consumer<CustomGeneratedEventAliased> getGeneratedEventsConsumer() {
        xf_2 a2;
        return a2.c;
    }

    public String java_lang_String_j() {
        xf_2 a2;
        return a2.K;
    }

    public void onDepth(String a2, boolean a3, int a4, int a5) {
        xf_2 a6;
        if (!a6.boolean_E((String)a2)) {
            return;
        }
        if (a4 <= 0) {
            return;
        }
        xf_2 xf_22 = a6;
        xf_22.H.E(a3, a4, (long)a5);
        a2 = xf_22.E;
        synchronized (a2) {
            Iterator<yd> iterator;
            Iterator<yd> iterator2 = iterator = a6.a.iterator();
            while (iterator2.hasNext()) {
                iterator.next().E(a6.b, a4, a5, a3);
                iterator2 = iterator;
            }
            return;
        }
    }

    public String java_lang_String_E() {
        xf_2 a2;
        return a2.h;
    }

    public void void_E() {
        xf_2 a2;
        Object object = a2.E;
        synchronized (object) {
            Iterator<yd> iterator;
            Iterator<yd> iterator2 = iterator = a2.a.iterator();
            while (iterator2.hasNext()) {
                iterator.next().j();
                iterator2 = iterator;
            }
            a2.a.clear();
            return;
        }
    }

    public void onMboReplace(String a2, String a3, int a4, int a5) {
        xf_2 a6;
        if (!a6.boolean_E((String)a2)) {
            return;
        }
        if (a4 <= 0) {
            return;
        }
        a2 = a6.E;
        synchronized (a2) {
            Iterator<yd> iterator;
            Iterator<yd> iterator2 = iterator = a6.a.iterator();
            while (iterator2.hasNext()) {
                iterator.next().E(a6.b, a3, a4, a5);
                iterator2 = iterator;
            }
            return;
        }
    }
}

