/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.indicators.StrategyUpdateGeneratorFilter$StrategyUpdateGeneratorEventType
 */
package ttw.tradefinder;

import java.awt.Color;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import ttw.tradefinder.Oc;
import ttw.tradefinder.Pc;
import ttw.tradefinder.af_0;
import ttw.tradefinder.cC;
import ttw.tradefinder.ca_1;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.dE;
import ttw.tradefinder.da_1;
import ttw.tradefinder.db_0;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.eb_1;
import ttw.tradefinder.fC;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.hb_0;
import ttw.tradefinder.hd;
import ttw.tradefinder.he_1;
import ttw.tradefinder.ib_0;
import ttw.tradefinder.ic_0;
import ttw.tradefinder.l;
import ttw.tradefinder.lD;
import ttw.tradefinder.la_1;
import ttw.tradefinder.qc_0;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.r_0;
import ttw.tradefinder.re_1;
import ttw.tradefinder.sf_1;
import ttw.tradefinder.tb_0;
import ttw.tradefinder.v_0;
import ttw.tradefinder.wB;
import ttw.tradefinder.xa_1;
import ttw.tradefinder.yb_0;
import ttw.tradefinder.za_1;
import velox.api.layer1.messages.indicators.StrategyUpdateGeneratorFilter;

public class ze
implements r_0 {
    private final dE C;
    private final ff_1 M;
    public static final String b = "TTW-HiddenOrders";
    private final sf_1 c;

    @Override
    public /* synthetic */ l E(qc_1 a2) {
        ze a3;
        switch (a3.c) {
            case w: {
                return new Pc(a3.c.toString(), Arrays.asList(cd.A, cd.C, cd.c, cd.D), a2);
            }
            case B: 
            case a: 
            case D: {
                return new Pc(a3.c.toString(), Arrays.asList(cd.h, cd.A, cd.C, cd.c, cd.D), a2);
            }
            case N: {
                return new Pc(a3.c.toString(), Arrays.asList(cd.C, cd.c, cd.D), a2);
            }
            case Y: {
                return new Pc(a3.c.toString(), Arrays.asList(cd.C), Arrays.asList(dd_1.c), a2);
            }
        }
        return new hb_0();
    }

    public /* synthetic */ sf_1 E() {
        ze a2;
        return a2.c;
    }

    @Override
    public /* synthetic */ String j() {
        return "";
    }

    @Override
    public /* synthetic */ cc_0 E() {
        ze a2;
        switch (a2.M) {
            case t: {
                cc_0 cc_02 = Oc.a();
                while (false) {
                }
                return cc_02;
            }
            case m: {
                return Oc.C();
            }
        }
        return new cc_0("Sample", "184.3", af_0.B, null, Collections.emptyList(), null);
    }

    @Override
    public /* synthetic */ String a() {
        return "";
    }

    @Override
    public /* synthetic */ String f() {
        return "TTW-HiddenOrders";
    }

    @Override
    public /* synthetic */ Color d() {
        ze a2;
        switch (a2.M) {
            case P: {
                while (false) {
                }
                return he_1.M;
            }
            case u: {
                return he_1.b;
            }
        }
        return Color.WHITE;
    }

    @Override
    public /* synthetic */ Color a() {
        return Color.WHITE;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String E() {
        ze a2;
        switch (a2.c) {
            case w: {
                return "Telegram Notifications";
            }
            case B: {
                return "Hidden Order (Iceberg) Line";
            }
            case a: {
                return "Hidden Order (Iceberg) Signal";
            }
            case N: {
                return "Hidden Order (Iceberg) Dom";
            }
            case Y: {
                return "Dynamic Iceberg Development";
            }
            case D: {
                return "Dynamic Hidden Order (Iceberg) Plot";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ String g() {
        return "";
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ v_0 E() {
        ze a2;
        switch (a2.M) {
            case s: 
            case P: 
            case u: 
            case t: 
            case m: 
            case U: 
            case Ba: {
                return a2.C;
            }
        }
        return null;
    }

    @Override
    public /* synthetic */ ca_1 E() {
        ze a2;
        if (a2.M == ff_1.U) {
            return new ca_1(he_1.M, he_1.b, he_1.j(he_1.D, 0), yb_0.c, qc_0.M, hd.b, za_1.M, 20, 20, 10);
        }
        return new ca_1();
    }

    @Override
    public /* synthetic */ String C() {
        return "";
    }

    @Override
    public /* synthetic */ Color E() {
        return Color.WHITE;
    }

    @Override
    public /* synthetic */ String A() {
        ze a2;
        switch (a2.M) {
            case s: {
                while (false) {
                }
                return "Hidden Order Trace";
            }
            case Ba: {
                return "Hidden Order DOM";
            }
            case P: {
                return "Hidden Ask Order";
            }
            case u: {
                return "Hidden Bid Order";
            }
            case t: {
                return "Hidden Ask Order Signal";
            }
            case m: {
                return "Hidden Bid Order Signal";
            }
            case U: {
                return "Dynamic Hidden Order Plot";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ Set<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> E() {
        HashSet<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> hashSet = new HashSet<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType>();
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.TRADES);
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.DEPTH_MBP);
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.DEPTH_MBO);
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.INSTRUMENTS);
        return hashSet;
    }

    @Override
    public /* synthetic */ ib_0 E() {
        return new ib_0();
    }

    @Override
    public /* synthetic */ ff_1 E() {
        ze a2;
        return a2.M;
    }

    @Override
    public /* synthetic */ l a(qc_1 a2) {
        ze a3;
        switch (a3.M) {
            case P: 
            case u: 
            case t: 
            case m: 
            case U: {
                return new Pc(a3.d(), Arrays.asList(cd.h, cd.A, cd.C, cd.c, cd.D), a2);
            }
            case y: {
                return new Pc(a3.M.toString(), Arrays.asList(cd.A, cd.C, cd.c, cd.D), a2);
            }
            case s: {
                return new Pc(a3.M.toString(), Arrays.asList(cd.C), Arrays.asList(dd_1.c), a2);
            }
            case Ba: {
                return new Pc(a3.M.toString(), Arrays.asList(cd.C, cd.c, cd.D), a2);
            }
        }
        return new hb_0();
    }

    @Override
    public /* synthetic */ String l() {
        return "";
    }

    @Override
    public /* synthetic */ fC E() {
        return new fC();
    }

    @Override
    public /* synthetic */ Color j() {
        return Color.WHITE;
    }

    public /* synthetic */ ze(dE a2, ff_1 a3, sf_1 a4) {
        ze a5;
        ze ze2 = a5;
        a5.C = a2;
        ze2.M = a3;
        ze2.c = a4;
    }

    @Override
    public /* synthetic */ String d() {
        ze a2;
        return a2.A();
    }

    @Override
    public /* synthetic */ String H() {
        return "";
    }

    @Override
    public /* synthetic */ l j(qc_1 a2) {
        return new Pc("strategy", Arrays.asList(cd.h, cd.A, cd.C, cd.c, cd.D), a2);
    }

    @Override
    public /* synthetic */ da_1 E() {
        ze a2;
        switch (a2.M) {
            case t: {
                return new da_1(db_0.b, xa_1.A, wB.M, la_1.h, cC.b, ic_0.b, 10, 70, 255);
            }
            case m: {
                return new da_1(db_0.b, xa_1.A, wB.c, la_1.D, cC.b, ic_0.b, 10, 70, 255);
            }
        }
        return new da_1();
    }

    @Override
    public /* synthetic */ tb_0 E() {
        ze a2;
        switch (a2.M) {
            case P: 
            case u: {
                return new tb_0(2, eb_1.M);
            }
        }
        return new tb_0();
    }
}

