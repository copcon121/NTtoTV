/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.CalculatedResultListener
 *  velox.api.layer1.layers.strategies.interfaces.InvalidateInterface
 *  velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable
 *  velox.api.layer1.layers.strategies.interfaces.OnlineValueCalculatorAdapter
 *  velox.api.layer1.messages.indicators.AliasFilter
 *  velox.api.layer1.messages.indicators.IndicatorColorScheme
 *  velox.api.layer1.messages.indicators.IndicatorLineStyle
 *  velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyIndicator
 *  velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyIndicator$GraphType
 */
package ttw.tradefinder;

import java.awt.Color;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import ttw.tradefinder.K;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.de_2;
import ttw.tradefinder.f_0;
import ttw.tradefinder.g_0;
import ttw.tradefinder.gg_0;
import ttw.tradefinder.jd_2;
import ttw.tradefinder.lb_2;
import ttw.tradefinder.qf_1;
import ttw.tradefinder.r_0;
import ttw.tradefinder.u_0;
import ttw.tradefinder.xd_2;
import ttw.tradefinder.yd_0;
import velox.api.layer1.layers.strategies.interfaces.CalculatedResultListener;
import velox.api.layer1.layers.strategies.interfaces.InvalidateInterface;
import velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable;
import velox.api.layer1.layers.strategies.interfaces.OnlineValueCalculatorAdapter;
import velox.api.layer1.messages.indicators.AliasFilter;
import velox.api.layer1.messages.indicators.IndicatorColorScheme;
import velox.api.layer1.messages.indicators.IndicatorLineStyle;
import velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyIndicator;

/*
 * Renamed from ttw.tradefinder.MA
 */
public abstract class ma_2
extends lb_2
implements g_0,
OnlineCalculatable {
    private boolean h;
    private Layer1ApiUserMessageModifyIndicator H;
    public final r_0 D;
    private final Object A;
    private boolean C;
    private String M;
    private final K b;
    private Map<String, InvalidateInterface> c;

    public Layer1ApiUserMessageModifyIndicator E(r_0 a2, f_0 a32, AliasFilter a4, boolean a5) {
        ma_2 a6;
        a2 = new Layer1ApiUserMessageModifyIndicator(a32.getClass(), a6.java_lang_String_E(), a5, (IndicatorColorScheme)new gg_0(a6, a32), null, IndicatorLineStyle.NONE, Color.white, Color.black, null, null, null, null, null, Layer1ApiUserMessageModifyIndicator.GraphType.PRIMARY, Boolean.FALSE, Boolean.FALSE, Boolean.TRUE, (OnlineCalculatable)a6, a4);
        int a32 = a6.int_E();
        if (a32 != -1) {
            ((Layer1ApiUserMessageModifyIndicator)a2).graphLayerRenderPriority = a32;
        }
        return a2;
    }

    private /* synthetic */ void A() {
        ma_2 a2;
        if (!a2.ttw_tradefinder_f_0_E().boolean_j() && !a2.D.boolean_E()) {
            return;
        }
        a2.h = true;
        if (!a2.b.E(dd_1.M)) {
            return;
        }
        if (a2.C) {
            return;
        }
        ma_2 ma_22 = a2;
        List<String> list = ma_22.E(ma_22.ttw_tradefinder_f_0_E().E(), a2.a());
        if (list.isEmpty()) {
            return;
        }
        ma_2 ma_23 = a2;
        ma_2 ma_24 = a2;
        ma_23.H = ma_23.E(ma_24.D, a2.ttw_tradefinder_f_0_E(), new jd_2(list), true);
        ma_24.M = ma_24.H.fullName;
        ma_23.ttw_tradefinder_f_0_E().E(a2.H);
        a2.C = true;
    }

    public void d(String a2) {
        ma_2 a3;
        if ((a2 = a3.c.get(a2)) != null) {
            a2.invalidate();
        }
    }

    @Override
    public boolean boolean_E(String a2) {
        ma_2 a3;
        return a2.equals(a3.M);
    }

    private /* synthetic */ List<String> E(List<String> a2, List<String> a3) {
        ArrayList<String> arrayList = new ArrayList<String>();
        a3 = a3.iterator();
        while (a3.hasNext()) {
            String string = (String)a3.next();
            if (!a2.contains(string)) continue;
            arrayList.add(string);
        }
        return arrayList;
    }

    @Override
    public void a() {
        ma_2 a2;
        ma_2 ma_22 = a2;
        super.a();
        ma_22.void_E();
        ma_22.b.void_E();
        ma_22.c.clear();
    }

    @Override
    public void E(K a2, boolean a3, boolean a4) {
        ma_2 a5;
        a2 = a5.A;
        synchronized (a2) {
            Object object;
            if (a3 && a5.h) {
                object = a2;
                a5.A();
            } else {
                if (!a3 && a5.C) {
                    a5.ttw_tradefinder_f_0_E().E(new Layer1ApiUserMessageModifyIndicator(a5.H, false));
                    a5.C = false;
                }
                object = a2;
            }
            // ** MonitorExit[v0] (shouldn't be in output)
            return;
        }
    }

    private /* synthetic */ void d() {
        ma_2 a2;
        a2.h = false;
        if (!a2.C) {
            return;
        }
        a2.ttw_tradefinder_f_0_E().E(new Layer1ApiUserMessageModifyIndicator(a2.H, false));
        a2.C = false;
    }

    @Override
    public Set<String> E() {
        ma_2 a2;
        return Collections.singleton(a2.M);
    }

    public void calculateValuesInRange(String a2, String a3, long a4, long a5, int a6, CalculatedResultListener a7) {
        ma_2 a8;
        if (!a8.boolean_E((String)a2)) {
            a7.setCompleted();
        }
        if ((a2 = a8.ttw_tradefinder_c_0_E(a3)) == null || !(a2 instanceof u_0)) {
            a7.setCompleted();
            return;
        }
        ((u_0)a2).E(a4, a5, a6, a7);
    }

    @Override
    public void void_E(String a2) {
        ma_2 a3;
        ma_2 ma_22 = a3;
        super.void_E(a2);
        ma_22.d(a2);
        ma_22.c.remove(a2);
    }

    @Override
    public void j() {
        ma_2 a2;
        Object object = a2.A;
        synchronized (object) {
            a2.A();
            return;
        }
    }

    public OnlineValueCalculatorAdapter createOnlineValueCalculator(String a2, String a3, long a4, Consumer<Object> a5, InvalidateInterface a6) {
        ma_2 a7;
        if (!a7.boolean_E((String)a2)) {
            return new yd_0(a7);
        }
        if (!a7.ttw_tradefinder_f_0_E().isStrategyEnabled(a3)) {
            return new qf_1(a7);
        }
        ma_2 ma_22 = a7;
        a2 = ma_22.ttw_tradefinder_c_0_E(ma_22.ttw_tradefinder_f_0_E().ttw_tradefinder_ze_2_E(a3), a7.ttw_tradefinder_f_0_E().ttw_tradefinder_xf_2_E(a3));
        if (!(a2 instanceof u_0)) {
            return new xd_2(a7);
        }
        a2 = (u_0)a2;
        a7.c.put(a3, a6);
        a2.E(a5, a6);
        return new de_2(a7);
    }

    @Override
    public void j(String a2, boolean a3) {
        ma_2 a4;
        a2 = a4.A;
        synchronized (a2) {
            if (!a4.h) {
                return;
            }
            ma_2 ma_22 = a4;
            ma_22.d();
            ma_22.A();
            return;
        }
    }

    public ma_2(f_0 a2, r_0 a3) {
        ma_2 a4;
        ma_2 ma_22 = a4;
        ma_2 ma_23 = a4;
        ma_2 ma_24 = a4;
        super(a2, a3.java_lang_String_d(), a3.ttw_tradefinder_v_0_E());
        ma_24.A = new Object();
        ma_24.c = Collections.synchronizedMap(new HashMap());
        ma_24.h = false;
        ma_23.C = false;
        ma_23.M = "";
        ma_22.b = a3.a(a2.ttw_tradefinder_qc_1_E()).E(a4);
        ma_22.D = a3;
    }

    public int int_E() {
        return -1;
    }

    @Override
    public void void_E() {
        ma_2 a2;
        Object object = a2.A;
        synchronized (object) {
            a2.d();
            return;
        }
    }
}

