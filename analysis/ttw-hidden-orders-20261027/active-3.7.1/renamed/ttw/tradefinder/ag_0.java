/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.Layer1ApiAdminAdapter
 *  velox.api.layer1.Layer1ApiAdminListener
 *  velox.api.layer1.Layer1ApiDataAdapter
 *  velox.api.layer1.Layer1ApiDataListener
 *  velox.api.layer1.Layer1ApiInstrumentAdapter
 *  velox.api.layer1.Layer1ApiInstrumentListener
 *  velox.api.layer1.Layer1ApiMboDataAdapter
 *  velox.api.layer1.Layer1ApiMboDataListener
 *  velox.api.layer1.Layer1ApiProvider
 *  velox.api.layer1.Layer1ApiTradingAdapter
 *  velox.api.layer1.Layer1ApiTradingListener
 *  velox.api.layer1.data.TradeInfo
 *  velox.api.layer1.messages.indicators.StrategyUpdateGeneratorFilter$StrategyUpdateGeneratorEventType
 */
package ttw.tradefinder;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import ttw.tradefinder.cd_2;
import ttw.tradefinder.x_0;
import velox.api.layer1.Layer1ApiAdminAdapter;
import velox.api.layer1.Layer1ApiAdminListener;
import velox.api.layer1.Layer1ApiDataAdapter;
import velox.api.layer1.Layer1ApiDataListener;
import velox.api.layer1.Layer1ApiInstrumentAdapter;
import velox.api.layer1.Layer1ApiInstrumentListener;
import velox.api.layer1.Layer1ApiMboDataAdapter;
import velox.api.layer1.Layer1ApiMboDataListener;
import velox.api.layer1.Layer1ApiProvider;
import velox.api.layer1.Layer1ApiTradingAdapter;
import velox.api.layer1.Layer1ApiTradingListener;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.messages.indicators.StrategyUpdateGeneratorFilter;

/*
 * Renamed from ttw.tradefinder.ag
 */
public class ag_0
implements Layer1ApiAdminAdapter,
Layer1ApiDataAdapter,
Layer1ApiInstrumentAdapter,
Layer1ApiMboDataAdapter,
Layer1ApiTradingAdapter {
    private long h;
    private final Layer1ApiProvider H;
    private Map<String, List<WeakReference<x_0>>> D;
    private final Object A;
    private final Set<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> C;
    private boolean M;
    private boolean b;
    private long c;

    public void onTrade(String a2, double a3, int a4, TradeInfo a5) {
        ag_0 a6;
        if (!a6.M) {
            return;
        }
        Object object = a6.A;
        synchronized (object) {
            a2 = a6.D.get(a2);
            if (a2 == null) {
                return;
            }
            a2 = a2.iterator();
            while (a2.hasNext()) {
                WeakReference weakReference = (WeakReference)a2.next();
                if (weakReference.get() == null) continue;
                ((x_0)weakReference.get()).E(a6.h, (int)(a3 + 0.5), a4, a5);
            }
            return;
        }
    }

    public void onMboSend(String a2, String a3, boolean a4, int a5, int a6) {
        ag_0 a7;
        if (!a7.M) {
            return;
        }
        Object object = a7.A;
        synchronized (object) {
            a2 = a7.D.get(a2);
            if (a2 == null) {
                return;
            }
            a2 = a2.iterator();
            while (a2.hasNext()) {
                WeakReference weakReference = (WeakReference)a2.next();
                if (weakReference.get() == null) continue;
                ((x_0)weakReference.get()).E(a7.h, a3, a5, a6, a4);
            }
            return;
        }
    }

    public void onMboCancel(String a2, String a3) {
        ag_0 a4;
        if (!a4.M) {
            return;
        }
        Object object = a4.A;
        synchronized (object) {
            a2 = a4.D.get(a2);
            if (a2 == null) {
                return;
            }
            a2 = a2.iterator();
            while (a2.hasNext()) {
                WeakReference weakReference = (WeakReference)a2.next();
                if (weakReference.get() == null) continue;
                ((x_0)weakReference.get()).E(a4.h, a3);
            }
            return;
        }
    }

    public void onDepth(String a2, boolean a3, int a4, int a5) {
        ag_0 a6;
        if (!a6.M) {
            return;
        }
        Object object = a6.A;
        synchronized (object) {
            a2 = a6.D.get(a2);
            if (a2 == null) {
                return;
            }
            a2 = a2.iterator();
            while (a2.hasNext()) {
                WeakReference weakReference = (WeakReference)a2.next();
                if (weakReference.get() == null) continue;
                ((x_0)weakReference.get()).E(a6.h, a4, a5, a3);
            }
            return;
        }
    }

    public void d() {
        ag_0 a2;
        a2.b = true;
        a2.M = false;
        a2.j();
        a2.void_E();
    }

    public void j(String a2, x_0 a3) {
        ag_0 a4;
        if (!a4.boolean_E()) {
            a4.a();
        }
        if (!a4.M) {
            return;
        }
        Object object = a4.A;
        synchronized (object) {
            if (!a4.D.containsKey(a2)) {
                a4.D.put(a2, new ArrayList());
            }
            a4.D.get(a2).add(new WeakReference<x_0>(a3));
        }
        a3.a();
    }

    private /* synthetic */ void a() {
        ag_0 a2;
        if (a2.b || a2.M) {
            return;
        }
        Iterator<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> iterator = a2.C.iterator();
        block0: while (true) {
            Iterator<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> iterator2 = iterator;
            while (iterator2.hasNext()) {
                StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType strategyUpdateGeneratorEventType = iterator.next();
                if (strategyUpdateGeneratorEventType == StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.DEPTH_MBP || strategyUpdateGeneratorEventType == StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.TRADES) {
                    a2.H.addListener((Layer1ApiDataListener)a2);
                    iterator2 = iterator;
                    continue;
                }
                if (strategyUpdateGeneratorEventType == StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.DEPTH_MBO) {
                    iterator2 = iterator;
                    a2.H.addListener((Layer1ApiMboDataListener)a2);
                    continue;
                }
                if (strategyUpdateGeneratorEventType == StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.INSTRUMENTS) {
                    iterator2 = iterator;
                    a2.H.addListener((Layer1ApiInstrumentListener)a2);
                    continue;
                }
                if (strategyUpdateGeneratorEventType == StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.TRADES) {
                    iterator2 = iterator;
                    a2.H.addListener((Layer1ApiTradingListener)a2);
                    continue;
                }
                if (strategyUpdateGeneratorEventType != StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.OTHER) continue block0;
                a2.H.addListener((Layer1ApiAdminListener)a2);
                continue block0;
            }
            break;
        }
        a2.M = true;
    }

    public void E(long a2) {
        ag_0 a3;
        if (!a3.M) {
            return;
        }
        a3.h = a2;
        if (a2 < a3.c) {
            return;
        }
        a3.c = a2 + cd_2.M;
        Object object = a3.A;
        synchronized (object) {
            for (List<WeakReference<x_0>> list : a3.D.values()) {
                for (WeakReference<x_0> weakReference : list) {
                    if (weakReference.get() == null) continue;
                    ((x_0)weakReference.get()).d(a2);
                }
            }
            return;
        }
    }

    public ag_0(Layer1ApiProvider a2, Set<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> a3) {
        ag_0 a4;
        ag_0 ag_02 = a4;
        ag_0 ag_03 = a4;
        ag_0 ag_04 = a4;
        a4.A = new Object();
        ag_04.h = Long.MIN_VALUE;
        ag_04.c = 0L;
        ag_03.M = false;
        ag_03.b = false;
        ag_03.D = Collections.synchronizedMap(new HashMap());
        ag_02.H = a2;
        ag_02.C = a3;
    }

    public void onMboReplace(String a2, String a3, int a4, int a5) {
        ag_0 a6;
        if (!a6.M) {
            return;
        }
        Object object = a6.A;
        synchronized (object) {
            a2 = a6.D.get(a2);
            if (a2 == null) {
                return;
            }
            a2 = a2.iterator();
            while (a2.hasNext()) {
                WeakReference weakReference = (WeakReference)a2.next();
                if (weakReference.get() == null) continue;
                ((x_0)weakReference.get()).E(a6.h, a3, a4, a5);
            }
            return;
        }
    }

    private /* synthetic */ boolean boolean_E() {
        ag_0 a2;
        Object object = a2.A;
        synchronized (object) {
            Object object2;
            boolean bl;
            Iterator<List<WeakReference<x_0>>> iterator;
            Object object3;
            for (List<WeakReference<x_0>> list : a2.D.values()) {
                object3 = list.iterator();
                while (object3.hasNext()) {
                    WeakReference<x_0> weakReference = object3.next();
                    if (weakReference.get() != null) continue;
                    object3.remove();
                }
            }
            int n2 = 0;
            Iterator<List<WeakReference<x_0>>> iterator2 = iterator = a2.D.values().iterator();
            while (iterator2.hasNext()) {
                object3 = iterator.next();
                n2 += object3.size();
                iterator2 = iterator;
            }
            if (n2 > 0) {
                bl = true;
                object2 = object;
            } else {
                bl = false;
                object2 = object;
            }
            // ** MonitorExit[v2] (shouldn't be in output)
            return bl;
        }
    }

    public void E(String a2) {
        ag_0 a3;
        Object object = a3.A;
        synchronized (object) {
            if (a3.D.containsKey(a2)) {
                Iterator<WeakReference<x_0>> iterator;
                Iterator<WeakReference<x_0>> iterator2 = iterator = a3.D.get(a2).iterator();
                while (iterator2.hasNext()) {
                    iterator.next().clear();
                    iterator2 = iterator;
                }
                a3.D.get(a2).clear();
            }
        }
        if (!a3.boolean_E()) {
            a3.j();
        }
    }

    public void E(String a2, x_0 a3) {
        ag_0 a4;
        Object object = a4.A;
        synchronized (object) {
            if (a4.D.containsKey(a2)) {
                a2 = a4.D.get(a2).iterator();
                block3: while (true) {
                    Object object2 = a2;
                    while (object2.hasNext()) {
                        WeakReference weakReference = (WeakReference)a2.next();
                        if (weakReference.get() == null) {
                            Object object3 = a2;
                            object2 = object3;
                            object3.remove();
                            continue;
                        }
                        if (weakReference.get() != a3) continue block3;
                        weakReference.clear();
                        a2.remove();
                        continue block3;
                    }
                    break;
                }
            }
        }
        if (!a4.boolean_E()) {
            a4.j();
        }
    }

    private /* synthetic */ void j() {
        ag_0 a2;
        if (!a2.M) {
            return;
        }
        a2.M = false;
        Iterator<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> iterator = a2.C.iterator();
        block0: while (true) {
            Iterator<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> iterator2 = iterator;
            while (iterator2.hasNext()) {
                StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType strategyUpdateGeneratorEventType = iterator.next();
                if (strategyUpdateGeneratorEventType == StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.DEPTH_MBP || strategyUpdateGeneratorEventType == StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.TRADES) {
                    a2.H.removeListener((Layer1ApiDataListener)a2);
                    iterator2 = iterator;
                    continue;
                }
                if (strategyUpdateGeneratorEventType == StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.DEPTH_MBO) {
                    iterator2 = iterator;
                    a2.H.removeListener((Layer1ApiMboDataListener)a2);
                    continue;
                }
                if (strategyUpdateGeneratorEventType == StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.INSTRUMENTS) {
                    iterator2 = iterator;
                    a2.H.removeListener((Layer1ApiInstrumentListener)a2);
                    continue;
                }
                if (strategyUpdateGeneratorEventType == StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.TRADES) {
                    iterator2 = iterator;
                    a2.H.removeListener((Layer1ApiTradingListener)a2);
                    continue;
                }
                if (strategyUpdateGeneratorEventType != StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.OTHER) continue block0;
                a2.H.removeListener((Layer1ApiAdminListener)a2);
                continue block0;
            }
            break;
        }
    }

    public void void_E() {
        ag_0 a2;
        Object object = a2.A;
        synchronized (object) {
            a2.D.clear();
            return;
        }
    }

    public void onUserMessage(Object a2) {
    }
}

