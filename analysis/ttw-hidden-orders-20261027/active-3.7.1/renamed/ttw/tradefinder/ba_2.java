/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.Layer1ApiAdminAdapter
 *  velox.api.layer1.Layer1ApiFinishable
 *  velox.api.layer1.Layer1ApiInstrumentAdapter
 *  velox.api.layer1.Layer1ApiProvider
 *  velox.api.layer1.Layer1CustomPanelsGetter
 *  velox.api.layer1.LayerApiListenable
 *  velox.api.layer1.common.ListenableHelper
 *  velox.api.layer1.common.Log
 *  velox.api.layer1.common.NanoClock
 *  velox.api.layer1.data.InstrumentInfo
 *  velox.api.layer1.layers.strategies.interfaces.Layer1PriceAxisRangeCalculatable
 *  velox.api.layer1.layers.strategies.interfaces.Layer1PriceAxisRangeCalculatable$InputPriceAxisInfo
 *  velox.api.layer1.layers.strategies.interfaces.Layer1PriceAxisRangeCalculatable$ResultPriceAxisInfo
 *  velox.api.layer1.messages.CurrentTimeUserMessage
 *  velox.api.layer1.messages.GeneratedEventInfo
 *  velox.api.layer1.messages.Layer1ApiRequestCurrentTimeEvents
 *  velox.api.layer1.messages.Layer1ApiSoundAlertMessage
 *  velox.api.layer1.messages.Layer1ApiUserMessageAddStrategyUpdateGenerator
 *  velox.api.layer1.messages.Layer1ApiUserMessageReloadStrategyGui
 *  velox.api.layer1.messages.UserMessageLayersChainCreatedTargeted
 *  velox.api.layer1.messages.UserMessageRewindBase
 *  velox.api.layer1.messages.indicators.SettingsAccess
 *  velox.api.layer1.messages.indicators.StrategyUpdateGenerator
 *  velox.api.layer1.settings.Layer1ConfigSettingsInterface
 *  velox.api.layer1.utils.IdHelper
 *  velox.api.layer1.utils.PriceRangeCalculationHelper
 *  velox.gui.StrategyPanel
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import ttw.tradefinder.ae_1;
import ttw.tradefinder.ag_0;
import ttw.tradefinder.bf_1;
import ttw.tradefinder.cd;
import ttw.tradefinder.cf_1;
import ttw.tradefinder.cf_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ed_2;
import ttw.tradefinder.es;
import ttw.tradefinder.f_0;
import ttw.tradefinder.fa_2;
import ttw.tradefinder.he_2;
import ttw.tradefinder.hf_1;
import ttw.tradefinder.ia;
import ttw.tradefinder.id_2;
import ttw.tradefinder.j;
import ttw.tradefinder.ja_2;
import ttw.tradefinder.k_0;
import ttw.tradefinder.lD;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.qd_2;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sa;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.sd_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.ue_1;
import ttw.tradefinder.wa_1;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.x_0;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.z_0;
import ttw.tradefinder.ze_2;
import velox.api.layer1.Layer1ApiAdminAdapter;
import velox.api.layer1.Layer1ApiFinishable;
import velox.api.layer1.Layer1ApiInstrumentAdapter;
import velox.api.layer1.Layer1ApiProvider;
import velox.api.layer1.Layer1CustomPanelsGetter;
import velox.api.layer1.LayerApiListenable;
import velox.api.layer1.common.ListenableHelper;
import velox.api.layer1.common.Log;
import velox.api.layer1.common.NanoClock;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.layers.strategies.interfaces.Layer1PriceAxisRangeCalculatable;
import velox.api.layer1.messages.CurrentTimeUserMessage;
import velox.api.layer1.messages.GeneratedEventInfo;
import velox.api.layer1.messages.Layer1ApiRequestCurrentTimeEvents;
import velox.api.layer1.messages.Layer1ApiSoundAlertMessage;
import velox.api.layer1.messages.Layer1ApiUserMessageAddStrategyUpdateGenerator;
import velox.api.layer1.messages.Layer1ApiUserMessageReloadStrategyGui;
import velox.api.layer1.messages.UserMessageLayersChainCreatedTargeted;
import velox.api.layer1.messages.UserMessageRewindBase;
import velox.api.layer1.messages.indicators.SettingsAccess;
import velox.api.layer1.messages.indicators.StrategyUpdateGenerator;
import velox.api.layer1.settings.Layer1ConfigSettingsInterface;
import velox.api.layer1.utils.IdHelper;
import velox.api.layer1.utils.PriceRangeCalculationHelper;
import velox.gui.StrategyPanel;

/*
 * Renamed from ttw.tradefinder.ba
 */
public abstract class ba_2
extends fa_2
implements AutoCloseable,
k_0,
Layer1ApiAdminAdapter,
Layer1ApiFinishable,
Layer1ApiInstrumentAdapter,
Layer1CustomPanelsGetter,
Layer1PriceAxisRangeCalculatable,
Layer1ConfigSettingsInterface {
    private id_2 L;
    private final Object l;
    private final Object m;
    private final ed_2 I;
    private final qc_1 f;
    private final Map<String, xf_2> F;
    private final String J;
    private final Map<String, Map<String, Object>> G;
    private boolean d;
    private final Class<?> i;
    private final Layer1ApiProvider e;
    private final ag_0 k;
    private boolean B;
    private final String K;
    private SettingsAccess E;
    private he_2 j;
    private df_0<sa, j> a;
    private final cf_1 h;
    private final ExecutorService H;
    private final Map<String, ze_2> D;
    private df_0<bf_1, es> A;
    private static int C;
    private static Object M;
    private boolean b;
    private final r_0 c;

    public void finish() {
        ba_2 a2;
        Object object = a2.m;
        synchronized (object) {
            if (a2.b) {
                return;
            }
            Log.warn((String)(a2.java_lang_String_E() + "-" + a2.java_lang_String_j()), (String)("FINISH " + a2.J + " 3.7.1 b3"));
            ba_2 ba_22 = a2;
            ba_2 ba_23 = a2;
            ListenableHelper.removeListeners((LayerApiListenable)ba_22.e, (Object)ba_23);
            ba_22.d();
            ba_23.void_j();
            ba_22.I.E();
            ba_22.f.void_E();
            ba_22.h.j();
            for (Map<String, Object> map : ba_22.G.values()) {
                for (Object object2 : map.values()) {
                    if (!(object2 instanceof ja_2)) continue;
                    ((ja_2)object2).E();
                }
            }
            if (a2.B) {
                ba_2 ba_24 = a2;
                ba_24.E(new Layer1ApiRequestCurrentTimeEvents(false, 0L, TimeUnit.MILLISECONDS.toNanos(50L)));
                Iterator<Object> iterator = ba_24.F.values().iterator();
                Iterator<Object> iterator2 = iterator;
                while (iterator2.hasNext()) {
                    xf_2 xf_22 = (xf_2)iterator.next();
                    xf_22.void_j();
                    iterator2 = iterator;
                    ba_2 ba_25 = a2;
                    ba_25.E(ba_25.E(false, xf_22));
                }
                ba_2 ba_26 = a2;
                ba_26.F.clear();
                ba_26.k.d();
                ba_26.L.void_j();
                ba_26.j.E();
            }
            a2.H.shutdown();
            try {
                a2.H.awaitTermination(3L, TimeUnit.SECONDS);
                ba_2 ba_27 = a2;
            }
            catch (InterruptedException interruptedException) {
                throw new RuntimeException(interruptedException);
            }
            ba_27.B = false;
            a2.b = true;
            return;
        }
    }

    public void onUserMessage(Object a2) {
        ba_2 a3;
        if (a2.getClass() == UserMessageLayersChainCreatedTargeted.class) {
            Object object = (UserMessageLayersChainCreatedTargeted)a2;
            if (object.targetClass == a3.getClass()) {
                Object object2 = a3.m;
                synchronized (object2) {
                    if (a3.B) {
                        return;
                    }
                    a3.B = true;
                    Log.warn((String)(a3.java_lang_String_E() + "-" + a3.java_lang_String_j()), (String)("START " + a3.J + " 3.7.1 b3"));
                    ba_2 ba_22 = a3;
                    ba_2 ba_23 = a3;
                    ba_22.L.E(ba_23.j(), (f_0)a3);
                    ba_22.h.E();
                    ba_23.I.j();
                    ba_22.L.void_E();
                    ba_22.f.void_j();
                    Iterator<xf_2> iterator = a2 = ba_22.F.values().iterator();
                    while (iterator.hasNext()) {
                        object = a2.next();
                        iterator = a2;
                        ba_2 ba_24 = a3;
                        ba_24.E(ba_24.E(true, (xf_2)object));
                    }
                    if (!a3.d || !a3.c.boolean_j()) {
                        a3.E(new Layer1ApiRequestCurrentTimeEvents(true, 0L, TimeUnit.MILLISECONDS.toNanos(200L)));
                    }
                    return;
                }
            }
            return;
        }
        if (a2 instanceof CurrentTimeUserMessage) {
            long l2 = ((CurrentTimeUserMessage)a2).time;
            if (!a3.d) {
                a3.L.E(l2);
            }
            a3.k.E(l2);
            return;
        }
        if (a2 instanceof UserMessageRewindBase && a3.B && !a3.b) {
            ba_2 ba_25 = a3;
            ba_25.L.j(ba_25.e.getCurrentTime());
        }
    }

    @Override
    public void j(String a2, String a3) {
        ba_2 a4;
        if (!a4.d) {
            return;
        }
        if (a3 == null || a3.isEmpty()) {
            return;
        }
        a2 = Layer1ApiSoundAlertMessage.builder().setAlias(a2).setSource(a4.i).setRepeatCount(1L).setRepeatDelay(null).setSound(null).setAlertDeclarationId("").setTextInfo(String.format(lD.E("+\u00014R+\u0001"), a2, a3)).build();
        a4.j(a2);
    }

    public abstract void d();

    public ba_2(String a2, Layer1ApiProvider a3, Class<?> a4, r_0 a5) {
        a6(a2, a3, a4, new wa_1(Collections.emptyMap()), a5);
        ba_2 a6;
    }

    @Override
    public void void_E(String a2, String a3) {
        ba_2 a4;
        if (a4.A == null) {
            return;
        }
        ((bf_1)a4.A.M).void_E(a2 + "." + a3);
    }

    private /* synthetic */ void j(int a2) {
        ba_2 a3;
        if (!a3.B || a3.b) {
            return;
        }
        try {
            a3.H.execute(() -> {
                try {
                    Thread.sleep(a2);
                    return;
                }
                catch (Exception exception) {
                    return;
                }
            });
            return;
        }
        catch (Exception exception) {
            return;
        }
    }

    public static int int_E() {
        Object object = M;
        synchronized (object) {
            return C++;
        }
    }

    @Override
    public ze_2 ttw_tradefinder_ze_2_E(String a2) {
        ba_2 a3;
        if (!a3.D.containsKey(a2)) {
            return ze_2.ttw_tradefinder_ze_2_E(a2);
        }
        return a3.D.get(a2);
    }

    @Override
    public String java_lang_String_E() {
        ba_2 a2;
        return a2.J;
    }

    public String java_lang_String_j() {
        ba_2 a2;
        return a2.K;
    }

    @Override
    public <T extends wa_2<TS>, TS extends ia> df_0<T, TS> E(String a2, T a3) {
        ba_2 a4;
        Object object = a4.l;
        synchronized (object) {
            if (!a4.G.containsKey(a2)) {
                a4.G.put((String)a2, new HashMap());
            }
            String string = (String)a2 + "." + ((wa_2)a3).E().getName();
            if ((a2 = a4.G.get(a2)).containsKey(string)) {
                return (df_0)a2.get(string);
            }
            ia ia2 = null;
            Object object2 = a3;
            try {
                if (a4.E != null) {
                    ia2 = (ia)a4.E.getSettings(null, string, ((wa_2)a3).E());
                }
            }
            catch (Exception exception) {}
            if (ia2 != null && !ia2.IsDefault) {
                ((wa_2)object2).void_E(ia2);
            }
            a3 = new df_0(object2);
            a2.put(string, a3);
            return a3;
        }
    }

    @Override
    public void E(Object a2) {
        ba_2 a3;
        if (!a3.B || a3.b) {
            return;
        }
        a3.e.sendUserMessage(a2);
    }

    @Override
    public cf_2 ttw_tradefinder_cf_2_E(String a2) {
        ba_2 a3;
        return new cf_2(a3.I, a2);
    }

    @Override
    public void void_E(cd a2) {
        ba_2 a3;
        a3.void_E();
    }

    @Override
    public boolean boolean_E(String a2, String a3) {
        ba_2 a4;
        if (a4.A == null) {
            return false;
        }
        return ((bf_1)a4.A.M).java_lang_Boolean_E(a2 + "." + a3);
    }

    public Map<String, Layer1PriceAxisRangeCalculatable.ResultPriceAxisInfo> getPriceRanges(String a2, double a3, Map<String, Layer1PriceAxisRangeCalculatable.InputPriceAxisInfo> a4) {
        Iterator<Map.Entry<String, Layer1PriceAxisRangeCalculatable.InputPriceAxisInfo>> iterator;
        HashMap<String, Layer1PriceAxisRangeCalculatable.ResultPriceAxisInfo> hashMap = new HashMap<String, Layer1PriceAxisRangeCalculatable.ResultPriceAxisInfo>();
        Iterator<Map.Entry<String, Layer1PriceAxisRangeCalculatable.InputPriceAxisInfo>> iterator2 = iterator = a4.entrySet().iterator();
        while (iterator2.hasNext()) {
            ba_2 a5;
            Map.Entry<String, Layer1PriceAxisRangeCalculatable.InputPriceAxisInfo> entry = iterator.next();
            String string = entry.getKey();
            Object object = a5.L.ttw_tradefinder_z_0_E(string);
            if (object == null || !(object instanceof sd_2)) {
                double d2 = Math.max(Math.abs(entry.getValue().minValue), Math.abs(entry.getValue().maxValue));
                iterator2 = iterator;
                hashMap.put(string, PriceRangeCalculationHelper.getGoodNumbersCalculation((double)(-d2), (double)d2, (double)a3));
                continue;
            }
            sd_2 sd_22 = (sd_2)object;
            hf_1 hf_12 = sd_22.ttw_tradefinder_hf_1_E();
            object = hf_12 == null ? Collections.singletonList(sd_22) : hf_12.E();
            double d2 = Double.POSITIVE_INFINITY;
            double d3 = Double.NEGATIVE_INFINITY;
            Iterator iterator3 = object.iterator();
            while (iterator3.hasNext()) {
                for (String string2 : ((z_0)iterator3.next()).E()) {
                    Layer1PriceAxisRangeCalculatable.InputPriceAxisInfo inputPriceAxisInfo = a4.get(string2);
                    if (inputPriceAxisInfo == null) continue;
                    d2 = Math.min(d2, inputPriceAxisInfo.minValue);
                    d3 = Math.max(d3, inputPriceAxisInfo.maxValue);
                }
            }
            if (d2 > d3) {
                double d4 = Math.max(Math.abs(entry.getValue().minValue), Math.abs(entry.getValue().maxValue));
                iterator2 = iterator;
                hashMap.put(string, PriceRangeCalculationHelper.getGoodNumbersCalculation((double)(-d4), (double)d4, (double)a3));
                continue;
            }
            if (sd_22.boolean_j(a2)) {
                double d5 = Math.max(Math.abs(d2), Math.abs(d3)) * 1.1;
                iterator2 = iterator;
                hashMap.put(string, PriceRangeCalculationHelper.getGoodNumbersCalculation((double)(-d5), (double)d5, (double)a3));
                continue;
            }
            hashMap.put(string, PriceRangeCalculationHelper.getGoodNumbersCalculation((double)d2, (double)d3, (double)a3));
            iterator2 = iterator;
        }
        return hashMap;
    }

    @Override
    public void void_E() {
        ba_2 a2;
        ba_2 ba_22 = a2;
        ba_22.j(100);
        ba_22.j(new Layer1ApiUserMessageReloadStrategyGui());
    }

    @Override
    public ed_2 ttw_tradefinder_ed_2_E() {
        ba_2 a2;
        return a2.I;
    }

    @Override
    public void E(String a2, String a3, boolean a4) {
        ba_2 a5;
        if (a5.A == null) {
            return;
        }
        ((bf_1)a5.A.M).E(a2 + "." + a3, a4);
        ba_2 ba_22 = a5;
        ba_22.E(ba_22.java_lang_String_E(), a5.A);
    }

    static {
        M = new Object();
        C = 0;
    }

    @Override
    public boolean boolean_j() {
        ba_2 a2;
        return a2.d;
    }

    private /* synthetic */ void E(Layer1ApiProvider a2) {
        ba_2 a3;
        long l2;
        long l3 = (long)((double)a2.getCurrentTime() / 1000000.0);
        a3.d = l3 + 15000L > (l2 = (long)((double)NanoClock.currentTimeNanos() / 1000000.0));
        Log.warn((String)(a3.java_lang_String_E() + "-" + a3.java_lang_String_j()), (String)("SESSION: " + (String)(a3.d ? ae_1.E("HhRd") : "REPLAY, DIFF: " + Long.toString(l2 - l3) + " ms")));
    }

    private /* synthetic */ String E(String a2, String a3, String a4) {
        if (a4.isEmpty()) {
            return a2 + "." + a3;
        }
        return a2 + "." + a3 + "." + a4;
    }

    public abstract List<z_0> j();

    public abstract Collection<? extends sc_1> E(ze_2 var1);

    public StrategyPanel[] getCustomGuiFor(String a2, String a3) {
        ba_2 a4;
        a3 = new ArrayList<sc_1>();
        a3.addAll(a4.L.E(a4.ttw_tradefinder_ze_2_E((String)a2), (f_0)a4));
        ba_2 ba_22 = a4;
        a3.addAll(ba_22.E(ba_22.ttw_tradefinder_ze_2_E((String)a2)));
        a3.add(sc_1.E((String)a2, a4));
        a2 = new TreeMap();
        a3 = a3.iterator();
        Iterator<? extends sc_1> iterator = a3;
        while (iterator.hasNext()) {
            sc_1 sc_12 = (sc_1)a3.next();
            int n2 = sc_12.int_E();
            Object object = a2;
            while (object.containsKey(n2)) {
                object = a2;
                ++n2;
            }
            a2.put(n2, new ue_1(sc_12));
            iterator = a3;
        }
        return a2.values().toArray(new StrategyPanel[0]);
    }

    @Override
    public cf_1 ttw_tradefinder_cf_1_E() {
        ba_2 a2;
        return a2.h;
    }

    public void onInstrumentAdded(String a2, InstrumentInfo a3) {
        ba_2 ba_22;
        ba_2 a4;
        if (a2 == null || a2.isEmpty()) {
            return;
        }
        ba_2 ba_23 = a4;
        ba_23.h.E(a2, true);
        ba_2 ba_24 = a4;
        if (ba_23.D.containsKey(a2)) {
            ba_24.D.get(a2).E(a3);
            ba_22 = a4;
        } else {
            String string = a2;
            ba_24.D.put(string, ze_2.E(string, a3));
            ba_22 = a4;
        }
        if (ba_22.isStrategyEnabled(a2)) {
            a4.E(a2, true);
        }
    }

    @Override
    public <T extends wa_2<TS>, TS extends ia> df_0<T, TS> E(String a2, String a3, String a4, T a5) {
        ba_2 a6;
        Object object = a6.l;
        synchronized (object) {
            Map<String, Object> map;
            if (!a6.G.containsKey(a3)) {
                a6.G.put((String)a3, new HashMap());
            }
            if ((map = a6.G.get(a3)).containsKey(a6.E(a2, a5.getClass().getName(), a4))) {
                return (df_0)map.get(a6.E(a2, a5.getClass().getName(), a4));
            }
            ia ia2 = null;
            Object object2 = a5;
            try {
                if (a6.E != null) {
                    ia2 = (ia)a6.E.getSettings((String)a3, a6.E(a2, ((wa_2)a5).E().getName(), a4), ((wa_2)a5).E());
                }
            }
            catch (Exception exception) {}
            if (ia2 != null && !ia2.IsDefault) {
                ((wa_2)object2).void_E(ia2);
            }
            a3 = new df_0(object2);
            map.put(a6.E(a2, a5.getClass().getName(), a4), a3);
            return a3;
        }
    }

    public void acceptSettingsInterface(SettingsAccess a2) {
        ba_2 a3;
        Object object = a3.l;
        synchronized (object) {
            a3.E = a2;
        }
        a3.f.void_a();
        ba_2 ba_22 = a3;
        super.void_a();
        ba_2 ba_23 = a3;
        ba_22.A = ba_22.E(ba_23.java_lang_String_E(), new bf_1());
        ba_23.a = ba_23.E(a3.java_lang_String_E(), new sa());
    }

    @Override
    public <T extends wa_2<TS>, TS extends ia> void E(df_0<T, TS> a2) {
        ba_2 a3;
        Object object = a3.l;
        synchronized (object) {
            ((wa_2)a2.M).b = false;
            if (a3.E != null) {
                a3.E.setSettings(null, "GLOBALSETTINGS." + ((wa_2)a2.M).E().getName(), ((wa_2)a2.M).E(), ((wa_2)a2.M).E());
            }
            return;
        }
    }

    @Override
    public <T extends wa_2<TS>, TS extends ia> df_0<T, TS> E(T a2) {
        ba_2 a3;
        Object object = a3.l;
        synchronized (object) {
            ia ia2 = null;
            Object object2 = a2;
            try {
                if (a3.E != null) {
                    ia2 = (ia)a3.E.getSettings(null, "GLOBALSETTINGS." + ((wa_2)a2).E().getName(), ((wa_2)a2).E());
                }
            }
            catch (Exception exception) {}
            if (ia2 != null && !ia2.IsDefault) {
                ((wa_2)object2).void_E(ia2);
            }
            a2 = new df_0(object2);
            return a2;
        }
    }

    @Override
    public xf_2 ttw_tradefinder_xf_2_E(String a2) {
        ba_2 a3;
        return a3.F.get(a2);
    }

    public void onInstrumentRemoved(String a2) {
        ba_2 a3;
        a3.E(a2, false);
        a3.h.E(a2, false);
    }

    @Override
    public qc_1 ttw_tradefinder_qc_1_E() {
        ba_2 a2;
        return a2.f;
    }

    @Override
    public void void_E(String a2) {
        ba_2 a3;
        Object object = a3.m;
        synchronized (object) {
            if (a3.F.containsKey(a2)) {
                a3.F.get(a2).void_E(a2);
            }
            a3.k.E(a2);
            return;
        }
    }

    public void j(Object a2) {
        ba_2 a3;
        if (!a3.B || a3.b) {
            return;
        }
        try {
            a3.H.execute(() -> {
                ba_2 a3;
                try {
                    a3.e.sendUserMessage(a2);
                    return;
                }
                catch (Exception a22) {
                    Log.warn((String)(a3.java_lang_String_E() + "-" + a3.java_lang_String_j()), (String)("EXCEPTION: " + a22.getMessage()));
                    return;
                }
            });
            return;
        }
        catch (Exception exception) {
            return;
        }
    }

    /*
     * Unable to fully structure code
     */
    @Override
    public boolean E(String a, boolean a) {
        var4_4 = a.m;
        synchronized (var4_4) {
            block11: {
                block9: {
                    block10: {
                        if (!a.B || a.b) {
                            return false;
                        }
                        v0 = a;
                        v0.L.a();
                        if (!v0.c.boolean_j()) break block9;
                        if (!a) break block10;
                        var3_5 = null;
                        if (!a.F.containsKey(a)) {
                            v1 = a;
                            var3_5 = new xf_2(a.D.get(a), v1.e, v1.c.E());
                            a.F.put(a, var3_5);
                        }
                        a.L.E(a.ttw_tradefinder_ze_2_E(a), a.F.get(a));
                        if (var3_5 != null) {
                            v2 = a;
                            v2.E(v2.E(true, var3_5));
                        }
                        ** GOTO lbl40
                    }
                    if (a.F.containsKey(a)) {
                        var3_6 = a.F.remove(a);
                        var3_6.void_j();
                        v3 = a;
                        v3.E(v3.E(false, var3_6));
                    }
                    v4 = a;
                    v5 = v4;
                    v4.void_E(a);
                    v4.L.j(a);
                    break block11;
                }
                v6 = a;
                if (a) {
                    v6.L.E(a.ttw_tradefinder_ze_2_E(a), (xf_2)null);
                    v5 = a;
                } else {
                    v6.void_E(a);
                    a.L.j(a);
lbl40:
                    // 2 sources

                    v5 = a;
                }
            }
            v5.L.void_E();
        }
        a.h.j(a, a);
        return true;
    }

    @Override
    public <T extends wa_2<TS>, TS extends ia> void E(String a2, df_0<T, TS> a3) {
        ba_2 a4;
        Object object = a4.l;
        synchronized (object) {
            String string = (String)a2 + "." + ((wa_2)a3.M).E().getName();
            if (!a4.G.containsKey(a2)) {
                a4.G.put((String)a2, new HashMap());
            }
            ((wa_2)a3.M).b = false;
            if (a4.E != null) {
                a4.E.setSettings(null, string, ((wa_2)a3.M).E(), ((wa_2)a3.M).E());
            }
            a2 = a4.G.get(a2);
            a2.put((String)string, a3);
            return;
        }
    }

    @Override
    public boolean boolean_E() {
        ba_2 a2;
        return ((sa)a2.a.M).c == df_1.c;
    }

    @Override
    public <T extends wa_2<TS>, TS extends ia> void E(String a2, String a3, String a4, df_0<T, TS> a5) {
        ba_2 a6;
        Object object = a6.l;
        synchronized (object) {
            ((wa_2)a5.M).b = false;
            if (!a6.G.containsKey(a3)) {
                a6.G.put((String)a3, new HashMap());
            }
            if (a6.E != null) {
                a6.E.setSettings((String)a3, a6.E(a2, ((wa_2)a5.M).E().getName(), a4), ((wa_2)a5.M).E(), ((wa_2)a5.M).E());
            }
            a3 = a6.G.get(a3);
            a3.put((String)a6.E(a2, a5.M.getClass().getName(), a4), a5);
            return;
        }
    }

    public ba_2(String a2, Layer1ApiProvider a3, Class<?> a4, wa_1 a5, r_0 a6) {
        ba_2 a7;
        ba_2 ba_22 = a7;
        ba_2 ba_23 = a7;
        ba_2 ba_24 = a7;
        ba_2 ba_25 = a7;
        ba_2 ba_26 = a7;
        ba_2 ba_27 = a7;
        ba_2 ba_28 = a7;
        a7.l = new Object();
        a7.m = new Object();
        ba_28.b = false;
        ba_28.E = null;
        ba_27.G = new HashMap<String, Map<String, Object>>();
        ba_27.A = null;
        ba_27.a = new df_0(new sa());
        ba_26.L = new id_2();
        ba_26.B = false;
        ba_26.F = new HashMap<String, xf_2>();
        ba_25.D = Collections.synchronizedMap(new HashMap());
        ba_25.d = false;
        ba_25.j = new he_2();
        ba_24.J = a2;
        ba_24.b = false;
        ba_23.i = a4;
        ba_23.e = a3;
        ba_22.K = IdHelper.generateShortUuid();
        a7.c = a6;
        ba_22.E(ba_22.e);
        Log.warn((String)(a7.java_lang_String_E() + "-" + a7.java_lang_String_j()), (String)("LOAD " + a7.J + " 3.7.1 b3"));
        ba_2 ba_29 = a7;
        a7.f = new qc_1(a7, a5);
        ba_2 ba_210 = a7;
        ba_210.I = new ed_2(ba_210, ba_210.c, a7.f);
        a7.H = Executors.newSingleThreadExecutor();
        a7.h = new cf_1(a7);
        a7.k = new ag_0(a3, a7.c.E());
        ba_29.E(a6, a7.f, a7.d);
        a5.E(ba_29);
        ListenableHelper.addListeners((LayerApiListenable)ba_29.e, (Object)a7);
    }

    @Override
    public <T extends wa_2<TS>, TS extends ia> df_0<T, TS> E(String a2, String a3, T a4) {
        ba_2 a5;
        return a5.E(a2, a3, "", a4);
    }

    @Override
    public void j(String a2, x_0 a3) {
        ba_2 a4;
        Object object = a4.m;
        synchronized (object) {
            block5: {
                Object object2;
                block4: {
                    block3: {
                        if (!a4.c.boolean_j()) break block3;
                        if (!a4.F.containsKey(a2)) break block4;
                        a4.F.get(a2).E(a2, a3);
                        object2 = object;
                        break block5;
                    }
                    a4.k.j(a2, a3);
                }
                object2 = object;
            }
            // ** MonitorExit[v0] (shouldn't be in output)
            return;
        }
    }

    @Override
    public Set<String> E() {
        ba_2 a2;
        return a2.L.E();
    }

    private /* synthetic */ Layer1ApiUserMessageAddStrategyUpdateGenerator E(boolean a22, xf_2 a3) {
        ba_2 a4;
        Layer1ApiUserMessageAddStrategyUpdateGenerator a22 = new Layer1ApiUserMessageAddStrategyUpdateGenerator(a4.i, a3.java_lang_String_j(), a22, true, true, (StrategyUpdateGenerator)a3, new GeneratedEventInfo[0]);
        return a22;
    }

    @Override
    public <T extends wa_2<TS>, TS extends ia> void E(String a2, String a3, df_0<T, TS> a4) {
        ba_2 a5;
        a5.E(a2, a3, "", a4);
    }

    @Override
    public void E(qd_2 a2) {
        ba_2 a3;
        if (!a3.d) {
            return;
        }
        if (a3.a == null) {
            return;
        }
        if (((sa)a3.a.M).c != df_1.c) {
            return;
        }
        try {
            a3.H.execute(() -> {
                try {
                    ba_2 a3;
                    a3.j.E(a2);
                    return;
                }
                catch (Exception exception) {
                    return;
                }
            });
            return;
        }
        catch (Exception exception) {
            return;
        }
    }

    @Override
    public void close() {
        ba_2 a2;
        a2.finish();
    }

    @Override
    public void j(qd_2 a2) {
        ba_2 a3;
        if (a2.c == te_1.A) {
            return;
        }
        a3.j.E(a2);
    }

    @Override
    public void E(String a2, x_0 a3) {
        ba_2 a4;
        Object object = a4.m;
        synchronized (object) {
            if (a4.F.containsKey(a2)) {
                a4.F.get(a2).j(a2, a3);
            }
            a4.k.E(a2, a3);
            return;
        }
    }
}

