/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.CalculatedResultListener
 *  velox.api.layer1.layers.strategies.interfaces.InvalidateInterface
 *  velox.api.layer1.layers.strategies.interfaces.Layer1IndicatorColorInterface
 *  velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable
 *  velox.api.layer1.layers.strategies.interfaces.OnlineValueCalculatorAdapter
 *  velox.api.layer1.messages.indicators.AliasFilter
 *  velox.api.layer1.messages.indicators.IndicatorColorInterface
 *  velox.api.layer1.messages.indicators.IndicatorColorScheme
 *  velox.api.layer1.messages.indicators.IndicatorColorScheme$ColorIntervalResponse
 *  velox.api.layer1.messages.indicators.IndicatorDisplayLogic
 *  velox.api.layer1.messages.indicators.IndicatorLineStyle
 *  velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyIndicator
 *  velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyIndicator$GraphType
 *  velox.api.layer1.messages.indicators.ValuesFormatter
 *  velox.api.layer1.messages.indicators.WidgetDisplayInfo
 *  velox.colors.ColorsChangedListener
 *  velox.gui.colors.ColorsConfigItem
 */
package ttw.tradefinder;

import java.awt.Color;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import ttw.tradefinder.K;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_2;
import ttw.tradefinder.ed_1;
import ttw.tradefinder.ee_2;
import ttw.tradefinder.f_0;
import ttw.tradefinder.fe_0;
import ttw.tradefinder.g_0;
import ttw.tradefinder.ha_2;
import ttw.tradefinder.hf_1;
import ttw.tradefinder.lb_2;
import ttw.tradefinder.pf_1;
import ttw.tradefinder.pf_2;
import ttw.tradefinder.qe_2;
import ttw.tradefinder.qf_2;
import ttw.tradefinder.r_0;
import ttw.tradefinder.u_0;
import ttw.tradefinder.ue_2;
import ttw.tradefinder.vd_2;
import ttw.tradefinder.wf_0;
import ttw.tradefinder.wf_1;
import ttw.tradefinder.yd_1;
import ttw.tradefinder.ze_1;
import velox.api.layer1.layers.strategies.interfaces.CalculatedResultListener;
import velox.api.layer1.layers.strategies.interfaces.InvalidateInterface;
import velox.api.layer1.layers.strategies.interfaces.Layer1IndicatorColorInterface;
import velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable;
import velox.api.layer1.layers.strategies.interfaces.OnlineValueCalculatorAdapter;
import velox.api.layer1.messages.indicators.AliasFilter;
import velox.api.layer1.messages.indicators.IndicatorColorInterface;
import velox.api.layer1.messages.indicators.IndicatorColorScheme;
import velox.api.layer1.messages.indicators.IndicatorDisplayLogic;
import velox.api.layer1.messages.indicators.IndicatorLineStyle;
import velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyIndicator;
import velox.api.layer1.messages.indicators.ValuesFormatter;
import velox.api.layer1.messages.indicators.WidgetDisplayInfo;
import velox.colors.ColorsChangedListener;
import velox.gui.colors.ColorsConfigItem;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.Sd
 */
public abstract class sd_2
extends lb_2
implements g_0,
Layer1IndicatorColorInterface,
OnlineCalculatable {
    private Map<String, InvalidateInterface> j;
    private hf_1 a;
    private Map<String, Color> h;
    private final K H;
    private final Map<String, Layer1ApiUserMessageModifyIndicator> D;
    private boolean A;
    private Set<String> C;
    public final r_0 M;
    private final Object b;
    private DecimalFormat c;

    public Color getColor(String a2, String a3) {
        sd_2 a4;
        a2 = ((wf_0)a4.E().E((String)a4.M.f(), (String)a2, new wf_0()).M).E(a3);
        if (a2 != null) {
            return a2;
        }
        a2 = a4.h.get(a3);
        if (a2 != null) {
            return a2;
        }
        return Color.WHITE;
    }

    @Override
    public void j() {
        sd_2 a2;
        Object object = a2.b;
        synchronized (object) {
            if (!a2.E().j() && !a2.M.E()) {
                return;
            }
            a2.A = true;
            if (!a2.H.E(dd_1.M)) {
                return;
            }
            if (a2.D.size() > 0) {
                return;
            }
            sd_2 sd_22 = a2;
            sd_22.C.clear();
            Object object2 = sd_22.E(sd_22.E().E(), a2.a());
            if (object2.isEmpty()) {
                return;
            }
            Object object3 = object2 = object2.iterator();
            while (object3.hasNext()) {
                String string = (String)object2.next();
                object3 = object2;
                a2.H(string);
            }
            return;
        }
    }

    @Override
    public void j(String a2, boolean a3) {
        sd_2 a4;
        Object object = a4.b;
        synchronized (object) {
            Object object2;
            if (!a4.A) {
                return;
            }
            sd_2 sd_22 = a4;
            if (a3) {
                sd_22.H(a2);
                object2 = object;
            } else {
                sd_22.A(a2);
                object2 = object;
            }
            // ** MonitorExit[v1] (shouldn't be in output)
            return;
        }
    }

    public ColorsConfigItem E(String a2, String a3, ColorsChangedListener a4) {
        sd_2 a5;
        Color color = Color.WHITE;
        if (a5.h.containsKey(a3)) {
            color = a5.h.get(a3);
        }
        qf_2 qf_22 = new qf_2(a5, a2);
        qf_22.addColorChangeListener(a4);
        String string = a3;
        return new ColorsConfigItem(string, string, false, color, (IndicatorColorInterface)qf_22, (ColorsChangedListener)new yd_1(a5, a2));
    }

    public abstract String E(r_0 var1, Double var2);

    public void E(hf_1 a2) {
        a.a = a2;
    }

    public void addColorChangeListener(ColorsChangedListener a2) {
    }

    public int E() {
        return -1;
    }

    public abstract List<ha_2> E(r_0 var1);

    public Layer1ApiUserMessageModifyIndicator E(String a2, boolean a32) {
        int n2;
        sd_2 a4;
        sd_2 sd_22 = a4;
        Layer1ApiUserMessageModifyIndicator a32 = new Layer1ApiUserMessageModifyIndicator(a4.E().getClass(), a4.E(), a32, (IndicatorColorScheme)new ze_1(a4), (Layer1IndicatorColorInterface)sd_22, sd_22.E(a2), Color.white, Color.black, new IndicatorDisplayLogic().setValuesFormatter((ValuesFormatter)new pf_1(a4)), null, null, null, null, Layer1ApiUserMessageModifyIndicator.GraphType.BOTTOM, Boolean.TRUE, Boolean.FALSE, Boolean.TRUE, (OnlineCalculatable)a4, (AliasFilter)new pf_2(a2));
        new Layer1ApiUserMessageModifyIndicator(a4.E().getClass(), a4.E(), a32, (IndicatorColorScheme)new ze_1(a4), (Layer1IndicatorColorInterface)sd_22, sd_22.E(a2), Color.white, Color.black, new IndicatorDisplayLogic().setValuesFormatter((ValuesFormatter)new pf_1(a4)), null, null, null, null, Layer1ApiUserMessageModifyIndicator.GraphType.BOTTOM, Boolean.TRUE, Boolean.FALSE, Boolean.TRUE, (OnlineCalculatable)a4, (AliasFilter)new pf_2(a2)).horizontalValueLinesInfo = new wf_1(a4);
        WidgetDisplayInfo widgetDisplayInfo = a4.E();
        if (widgetDisplayInfo != null) {
            a32.widgetDisplayInfo = widgetDisplayInfo;
        }
        if ((n2 = a4.E()) != -1) {
            a32.graphLayerRenderPriority = n2;
        }
        a32.isWidgetEnabledByDefault = true;
        a32.applyNameModifier(a2);
        return a32;
    }

    @Override
    public void E(K a2, boolean a3, boolean a4) {
        sd_2 a5;
        if (a3 && a5.A) {
            a5.j();
            return;
        }
        if (!a3 && a5.D.size() > 0) {
            a5.E();
        }
    }

    @Override
    public boolean E(String a2) {
        sd_2 a3;
        return a3.C.contains(a2);
    }

    @Override
    public void E() {
        sd_2 a2;
        Object object = a2.b;
        synchronized (object) {
            Iterator<Layer1ApiUserMessageModifyIndicator> iterator;
            a2.A = false;
            Iterator<Layer1ApiUserMessageModifyIndicator> iterator2 = iterator = a2.D.values().iterator();
            while (iterator2.hasNext()) {
                Layer1ApiUserMessageModifyIndicator layer1ApiUserMessageModifyIndicator = iterator.next();
                iterator2 = iterator;
                a2.E().E(new Layer1ApiUserMessageModifyIndicator(layer1ApiUserMessageModifyIndicator, false));
            }
            sd_2 sd_22 = a2;
            sd_22.D.clear();
            sd_22.C.clear();
            return;
        }
    }

    public WidgetDisplayInfo E() {
        return null;
    }

    public void setColor(String a2, String a3, Color a4) {
        sd_2 a5;
        df_0 df_02 = a5.E().E(a5.M.f(), a2, new wf_0());
        ((wf_0)df_02.M).E(a3, a4);
        a5.E().E(a5.M.f(), a2, df_02);
    }

    @Override
    public void E(String a2) {
        sd_2 a3;
        sd_2 sd_22 = a3;
        super.E(a2);
        sd_22.d(a2);
        sd_22.j.remove(a2);
    }

    @Override
    public void a() {
        sd_2 a2;
        sd_2 sd_22 = a2;
        super.a();
        sd_22.E();
        sd_22.H.E();
        sd_22.j.clear();
    }

    public abstract IndicatorColorScheme.ColorIntervalResponse E(r_0 var1, double var2, double var4);

    public void l(String a2) {
        sd_2 a3;
        Object object = a3.b;
        synchronized (object) {
            if (!a3.D.containsKey(a2)) {
                return;
            }
            sd_2 sd_22 = a3;
            String string = a2;
            sd_22.A(string);
            sd_22.H(string);
            return;
        }
    }

    public IndicatorLineStyle E(String a2) {
        sd_2 a3;
        if ((a2 = a3.E((String)a2)) == null || !(a2 instanceof ed_1)) {
            return IndicatorLineStyle.DEFAULT;
        }
        return ((ed_1)a2).E();
    }

    public sd_2(f_0 a2, r_0 a3) {
        sd_2 a4;
        sd_2 sd_22 = a4;
        sd_2 sd_23 = a4;
        sd_2 sd_24 = a4;
        sd_2 sd_25 = a4;
        super((f_0)((Object)a2), a3.d(), a3.E());
        a4.b = new Object();
        sd_25.j = Collections.synchronizedMap(new HashMap());
        sd_25.D = new HashMap<String, Layer1ApiUserMessageModifyIndicator>();
        sd_25.A = false;
        sd_24.C = Collections.synchronizedSet(new HashSet());
        sd_23.a = null;
        sd_24.h = new HashMap<String, Color>();
        sd_23.c = new DecimalFormat(qe_2.E(")!),"));
        sd_22.H = a3.a(a2.E()).E(a4);
        sd_22.M = a3;
        a2 = sd_22.E(sd_22.M);
        Iterator<ha_2> iterator = a2 = a2.iterator();
        while (iterator.hasNext()) {
            a3 = a2.next();
            iterator = a2;
            Object object = a3;
            a4.h.put(((ha_2)object).b, ((ha_2)object).c);
        }
    }

    private /* synthetic */ void H(String a2) {
        sd_2 a3;
        if (a3.D.containsKey(a2)) {
            return;
        }
        sd_2 sd_22 = a3;
        Layer1ApiUserMessageModifyIndicator layer1ApiUserMessageModifyIndicator = sd_22.E(a2, true);
        sd_22.C.add(layer1ApiUserMessageModifyIndicator.fullName);
        a3.D.put(a2, layer1ApiUserMessageModifyIndicator);
        a3.E().E(layer1ApiUserMessageModifyIndicator);
    }

    public void calculateValuesInRange(String a2, String a3, long a4, long a5, int a6, CalculatedResultListener a7) {
        sd_2 a8;
        if (!a8.E((String)a2)) {
            a7.setCompleted();
        }
        if ((a2 = a8.E(a3)) == null || !(a2 instanceof u_0)) {
            a7.setCompleted();
            return;
        }
        ((u_0)a2).E(a4, a5, a6, a7);
    }

    @Override
    public Set<String> E() {
        sd_2 a2;
        return a2.C;
    }

    public boolean j(String a2) {
        sd_2 a3;
        if ((a2 = a3.E((String)a2)) == null || !(a2 instanceof ed_1)) {
            return false;
        }
        return ((ed_1)a2).j();
    }

    public ColorsConfigItem E(String a2, String a3) {
        sd_2 a4;
        return a4.E(a2, a3, new vd_2(a4));
    }

    public hf_1 E() {
        sd_2 a2;
        return a2.a;
    }

    private /* synthetic */ void A(String a2) {
        sd_2 a3;
        if (!a3.D.containsKey(a2)) {
            return;
        }
        a2 = a3.D.remove(a2);
        a3.C.remove(((Layer1ApiUserMessageModifyIndicator)a2).fullName);
        a3.E().E(new Layer1ApiUserMessageModifyIndicator((Layer1ApiUserMessageModifyIndicator)a2, false));
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

    public OnlineValueCalculatorAdapter createOnlineValueCalculator(String a2, String a3, long a4, Consumer<Object> a5, InvalidateInterface a6) {
        sd_2 a7;
        if (!a7.E((String)a2)) {
            return new df_2(a7);
        }
        if (!a7.E().isStrategyEnabled(a3)) {
            return new fe_0(a7);
        }
        sd_2 sd_22 = a7;
        a2 = sd_22.E(sd_22.E().E(a3), a7.E().E(a3));
        if (!(a2 instanceof u_0)) {
            return new ee_2(a7);
        }
        a2 = (u_0)a2;
        a7.j.put(a3, a6);
        a2.E(a5, a6);
        return new ue_2(a7);
    }

    public void d(String a2) {
        sd_2 a3;
        if ((a2 = a3.j.get(a2)) != null) {
            a2.invalidate();
        }
    }

    public Map<Double, String> E(r_0 a2, String a3) {
        return new HashMap<Double, String>();
    }
}

