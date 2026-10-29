/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainter
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainterFactory
 *  velox.api.layer1.messages.indicators.AliasFilter
 *  velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyScreenSpacePainter
 *  velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyScreenSpacePainter$Builder
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import ttw.tradefinder.K;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.f_0;
import ttw.tradefinder.g_0;
import ttw.tradefinder.jd_2;
import ttw.tradefinder.lb_2;
import ttw.tradefinder.me_2;
import ttw.tradefinder.o_0;
import ttw.tradefinder.r_0;
import ttw.tradefinder.rf_2;
import ttw.tradefinder.ze_0;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainter;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainterFactory;
import velox.api.layer1.messages.indicators.AliasFilter;
import velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyScreenSpacePainter;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.ib
 */
public abstract class ib_2
extends lb_2
implements g_0,
ScreenSpacePainterFactory {
    private boolean D;
    private boolean A;
    private Layer1ApiUserMessageModifyScreenSpacePainter.Builder C;
    private final r_0 M;
    private final K b;
    private String c;

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
    public void E() {
        ib_2 a2;
        a2.D = false;
        if (!a2.A) {
            return;
        }
        a2.E().E(a2.C.setIsAdd(false).build());
        a2.A = false;
    }

    @Override
    public Set<String> E() {
        ib_2 a2;
        return Collections.singleton(a2.c);
    }

    public ScreenSpacePainter createScreenSpacePainter(String a2, String a3, ScreenSpaceCanvasFactory a4) {
        ib_2 a5;
        if (!a5.E((String)a2)) {
            return new me_2(a5);
        }
        if (!a5.E().isStrategyEnabled(a3)) {
            return new ze_0(a5);
        }
        ib_2 ib_22 = a5;
        a2 = ib_22.E(ib_22.E().E(a3), a5.E().E(a3));
        if (!(a2 instanceof o_0)) {
            return new rf_2(a5);
        }
        a2 = (o_0)a2;
        a2.E().E(a4);
        return a2.E();
    }

    public ib_2(f_0 a2, r_0 a3) {
        ib_2 a4;
        f_0 f_02 = a2;
        ib_2 ib_22 = a4;
        ib_2 ib_23 = a4;
        super(a2, a3.d(), a3.E());
        a4.D = false;
        ib_23.A = false;
        ib_23.c = "";
        ib_22.M = a3;
        ib_22.b = a3.a(f_02.E()).E(a4);
        a4.C = Layer1ApiUserMessageModifyScreenSpacePainter.builder(f_02.getClass(), (String)a4.E()).setScreenSpacePainterFactory((ScreenSpacePainterFactory)a4);
    }

    public void d(String a2) {
    }

    @Override
    public void j() {
        ib_2 a2;
        if (!a2.E().j() && !a2.M.E()) {
            return;
        }
        a2.D = true;
        if (!a2.b.E(dd_1.M)) {
            return;
        }
        if (a2.A) {
            return;
        }
        ib_2 ib_22 = a2;
        Layer1ApiUserMessageModifyScreenSpacePainter layer1ApiUserMessageModifyScreenSpacePainter = ib_22.E(ib_22.E().E(), a2.a());
        if (layer1ApiUserMessageModifyScreenSpacePainter.isEmpty()) {
            return;
        }
        ib_2 ib_23 = a2;
        layer1ApiUserMessageModifyScreenSpacePainter = ib_23.C.setIsAdd(true).setAliasFilter((AliasFilter)new jd_2((List<String>)layer1ApiUserMessageModifyScreenSpacePainter)).build();
        ib_23.c = layer1ApiUserMessageModifyScreenSpacePainter.fullName;
        ib_23.E().E(layer1ApiUserMessageModifyScreenSpacePainter);
        ib_23.A = true;
    }

    @Override
    public void E(K a2, boolean a3, boolean a4) {
        ib_2 a5;
        if (a3 && a5.D) {
            a5.j();
            return;
        }
        if (!a3 && a5.A) {
            a5.E().E(a5.C.setIsAdd(false).build());
            a5.A = false;
        }
    }

    @Override
    public boolean E(String a2) {
        ib_2 a3;
        return a2.equals(a3.c);
    }

    public r_0 E() {
        ib_2 a2;
        return a2.M;
    }

    @Override
    public void a() {
        ib_2 a2;
        ib_2 ib_22 = a2;
        super.a();
        ib_22.E();
        ib_22.b.E();
    }

    @Override
    public void j(String a2, boolean a3) {
        ib_2 a4;
        if (!a4.D) {
            return;
        }
        ib_2 ib_22 = a4;
        ib_22.E();
        ib_22.j();
    }
}

