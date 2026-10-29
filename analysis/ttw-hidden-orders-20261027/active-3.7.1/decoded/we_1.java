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
import ttw.tradefinder.Ic;
import ttw.tradefinder.Oc;
import ttw.tradefinder.Pc;
import ttw.tradefinder.af_0;
import ttw.tradefinder.af_2;
import ttw.tradefinder.cC;
import ttw.tradefinder.ca_1;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.da_1;
import ttw.tradefinder.db_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.eC;
import ttw.tradefinder.eb_1;
import ttw.tradefinder.fC;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.hb_0;
import ttw.tradefinder.he_1;
import ttw.tradefinder.ib_0;
import ttw.tradefinder.ic_0;
import ttw.tradefinder.if_0;
import ttw.tradefinder.l;
import ttw.tradefinder.la_1;
import ttw.tradefinder.lc_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sf_1;
import ttw.tradefinder.tb_0;
import ttw.tradefinder.v_0;
import ttw.tradefinder.wB;
import ttw.tradefinder.xa_1;
import velox.api.layer1.messages.indicators.StrategyUpdateGeneratorFilter;

/*
 * Renamed from ttw.tradefinder.wE
 */
public class we_1
implements r_0 {
    private final ff_1 C;
    private final lg M;
    public static final String b = "TTW-MarketExplorer";
    private final sf_1 c;

    @Override
    public /* synthetic */ tb_0 E() {
        we_1 a2;
        switch (a2.C) {
            case h: {
                return new tb_0(2, eb_1.M);
            }
            case Ga: {
                return new tb_0(3, eb_1.M);
            }
            case L: {
                return new tb_0(2, eb_1.C);
            }
            case ha: {
                return new tb_0(2, eb_1.C);
            }
        }
        return new tb_0();
    }

    @Override
    public /* synthetic */ ff_1 E() {
        we_1 a2;
        return a2.C;
    }

    public /* synthetic */ sf_1 E() {
        we_1 a2;
        return a2.c;
    }

    @Override
    public /* synthetic */ da_1 E() {
        we_1 a2;
        switch (a2.C) {
            case v: {
                return new da_1(db_0.b, xa_1.A, wB.M, la_1.c, cC.b, ic_0.b, 10, 90, 255);
            }
            case ga: {
                return new da_1(db_0.b, xa_1.A, wB.c, la_1.b, cC.b, ic_0.b, 10, 90, 255);
            }
            case B: {
                return new da_1(db_0.b, xa_1.C, wB.M, la_1.D, cC.b, ic_0.b, 10, 70, 255);
            }
            case ia: {
                return new da_1(db_0.b, xa_1.C, wB.c, la_1.H, cC.b, ic_0.b, 10, 70, 255);
            }
            case Q: {
                return new da_1(db_0.b, xa_1.b, wB.M, la_1.c, cC.b, ic_0.b, 10, 30, 255);
            }
            case f: {
                return new da_1(db_0.b, xa_1.b, wB.c, la_1.C, cC.b, ic_0.b, 10, 30, 255);
            }
            case i: {
                return new da_1(db_0.c, xa_1.C, wB.M, la_1.b, cC.A, ic_0.M, 10, 90, 255);
            }
            case q: {
                return new da_1(db_0.c, xa_1.C, wB.c, la_1.c, cC.A, ic_0.M, 10, 90, 255);
            }
        }
        return new da_1();
    }

    @Override
    public /* synthetic */ l j(qc_1 a2) {
        return new Pc("strategy", Arrays.asList(cd.h, cd.A, cd.C, cd.c, cd.D), a2);
    }

    @Override
    public /* synthetic */ String C() {
        we_1 a2;
        switch (a2.C) {
            case Ga: {
                while (false) {
                }
                return "Sell Volume";
            }
            case h: {
                return "Sell Stops";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ String a() {
        we_1 a2;
        return a2.C();
    }

    @Override
    public /* synthetic */ String f() {
        return "TTW-MarketExplorer";
    }

    @Override
    public /* synthetic */ String l() {
        we_1 a2;
        switch (a2.C) {
            case Ga: {
                while (false) {
                }
                return "Buy Volume";
            }
            case h: {
                return "Buy Stops";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ Color d() {
        we_1 a2;
        switch (a2.C) {
            case L: {
                while (false) {
                }
                return he_1.a;
            }
            case ha: {
                return he_1.K;
            }
        }
        return Color.WHITE;
    }

    @Override
    public /* synthetic */ l E(qc_1 a2) {
        we_1 a3;
        switch (a3.c) {
            case w: {
                return new Pc(a3.c.toString(), Arrays.asList(cd.A, cd.C, cd.c, cd.D), a2);
            }
            case Q: 
            case e: 
            case R: 
            case V: {
                return new Pc(a3.c.toString(), Arrays.asList(cd.h, cd.A, cd.C, cd.c, cd.D), a2);
            }
            case z: 
            case d: 
            case u: 
            case T: {
                return new Pc(a3.c.toString(), Arrays.asList(cd.C, cd.c, cd.D), a2);
            }
            case m: 
            case F: 
            case A: {
                return new Pc(a3.C.toString(), Collections.emptyList(), a2);
            }
        }
        return new hb_0();
    }

    @Override
    public /* synthetic */ String j() {
        we_1 a2;
        return a2.H();
    }

    @Override
    public /* synthetic */ fC E() {
        we_1 a2;
        switch (a2.C) {
            case R: {
                return new fC(eC.c, Ic.c, he_1.E(Color.decode("#FF3333"), 230), lc_0.b, df_1.c, 15);
            }
            case I: {
                return new fC(eC.c, Ic.c, he_1.E(Color.decode("#FFFFFF"), 230), lc_0.D, df_1.c, 15);
            }
            case da: {
                return new fC(eC.c, Ic.C, he_1.E(Color.decode("#FF3333"), 230), lc_0.b, df_1.c, 10);
            }
            case Ca: {
                return new fC(eC.c, Ic.C, he_1.E(Color.decode("#FFFFFF"), 230), lc_0.D, df_1.c, 10);
            }
            case k: {
                return new fC(eC.M, Ic.c, he_1.E(Color.decode("#FF3333"), 230), lc_0.b, df_1.c, 15);
            }
            case Ka: {
                return new fC(eC.D, Ic.c, he_1.E(Color.decode("#33FF33"), 230), lc_0.D, df_1.c, 15);
            }
        }
        return new fC();
    }

    @Override
    public /* synthetic */ ca_1 E() {
        return new ca_1();
    }

    @Override
    public /* synthetic */ String d() {
        we_1 a2;
        return a2.A();
    }

    @Override
    public /* synthetic */ l a(qc_1 a2) {
        we_1 a3;
        switch (a3.C) {
            case Ga: 
            case v: 
            case ga: 
            case R: 
            case I: 
            case da: 
            case Ca: {
                return new Pc(a3.d(), Arrays.asList(cd.h, cd.A, cd.C, cd.c, cd.D), a2);
            }
            case y: {
                return new Pc(a3.C.toString(), Arrays.asList(cd.A, cd.C, cd.c, cd.D), a2);
            }
            case h: 
            case B: 
            case ia: 
            case Q: 
            case f: 
            case i: 
            case q: {
                return new Pc(a3.C.toString(), Arrays.asList(cd.C, cd.c, cd.D), a2);
            }
            case k: 
            case Ka: 
            case d: 
            case L: 
            case ha: {
                return new Pc(a3.C.toString(), Collections.emptyList(), a2);
            }
        }
        return new hb_0();
    }

    @Override
    public /* synthetic */ String g() {
        we_1 a2;
        return a2.l();
    }

    @Override
    public /* synthetic */ Set<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> E() {
        HashSet<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> hashSet = new HashSet<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType>();
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.TRADES);
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.DEPTH_MBO);
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.INSTRUMENTS);
        return hashSet;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String E() {
        we_1 a2;
        switch (a2.c) {
            case w: {
                return "Telegram Notifications";
            }
            case Q: {
                return "Market Volume Stop Line";
            }
            case e: {
                return "Market Volume Stop Signal 1";
            }
            case R: {
                return "Market Volume Stop Signal 2";
            }
            case z: {
                return "Native Stop Volume Line";
            }
            case m: {
                return "Native Stop Volume Signal";
            }
            case V: {
                return "Volume Spike Signal";
            }
            case d: {
                return "Sweep Signal";
            }
            case u: {
                return "Native Stop Run Signal";
            }
            case T: {
                return "Absorption Signal";
            }
            case F: {
                return "Pace of Tape Line";
            }
            case A: {
                return "Market Speed Line";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ String H() {
        we_1 a2;
        switch (a2.C) {
            case Ga: {
                while (false) {
                }
                return "Volume Zero Line";
            }
            case h: {
                return "Stop Zero Line";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ Color E() {
        we_1 a2;
        switch (a2.C) {
            case Ga: {
                while (false) {
                }
                return he_1.j;
            }
            case h: {
                return he_1.b;
            }
        }
        return Color.WHITE;
    }

    @Override
    public /* synthetic */ ib_0 E() {
        return new ib_0();
    }

    @Override
    public /* synthetic */ Color j() {
        we_1 a2;
        switch (a2.C) {
            case Ga: {
                while (false) {
                }
                return he_1.c;
            }
            case h: {
                return he_1.M;
            }
        }
        return Color.WHITE;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ v_0 E() {
        we_1 a2;
        switch (a2.C) {
            case Ga: 
            case h: 
            case v: 
            case ga: 
            case B: 
            case ia: 
            case Q: 
            case f: 
            case i: 
            case q: 
            case R: 
            case I: 
            case da: 
            case Ca: 
            case k: 
            case Ka: 
            case d: 
            case L: 
            case ha: {
                return a2.M;
            }
        }
        return null;
    }

    @Override
    public /* synthetic */ cc_0 E() {
        we_1 a2;
        switch (a2.C) {
            case v: {
                cc_0 cc_02 = Oc.d();
                while (false) {
                }
                return cc_02;
            }
            case ga: {
                return Oc.H();
            }
            case B: {
                return Oc.l();
            }
            case ia: {
                return Oc.g();
            }
            case Q: {
                return Oc.E();
            }
            case f: {
                return Oc.f();
            }
            case i: {
                return Oc.j();
            }
            case q: {
                return Oc.A();
            }
        }
        return new cc_0("Sample", "184.3", af_0.B, null, Collections.emptyList(), null);
    }

    public /* synthetic */ we_1(lg a2, ff_1 a3, sf_1 a4) {
        we_1 a5;
        we_1 we_12 = a5;
        a5.M = a2;
        we_12.C = a3;
        we_12.c = a4;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ Color a() {
        we_1 a2;
        switch (a2.C) {
            case Ga: 
            case h: {
                return Color.WHITE;
            }
        }
        return Color.WHITE;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String A() {
        we_1 a2;
        switch (a2.C) {
            case Ga: {
                return "MV Stop";
            }
            case R: {
                return "Buy Market Volume Stop 1";
            }
            case I: {
                return "Sell Market Volume Stop 1";
            }
            case da: {
                return "Buy Market Volume Stop 2";
            }
            case Ca: {
                return "Sell Market Volume Stop 2";
            }
            case h: {
                return "Stop Volume";
            }
            case k: {
                return "Buy Stop Volume";
            }
            case Ka: {
                return "Sell Stop Volume";
            }
            case v: {
                return "Buy Volume Spike Signal";
            }
            case ga: {
                return "Sell Volume Spike Signal";
            }
            case B: {
                return "Buy Sweep Signal";
            }
            case ia: {
                return "Sell Sweep Signal";
            }
            case Q: {
                return "Buy Stop Run Signal";
            }
            case f: {
                return "Sell Stop Run Signal";
            }
            case i: {
                return "Buy Absorption Signal";
            }
            case q: {
                return "Sell Absorption Signal";
            }
            case d: {
                return "Stop Sweep Trace";
            }
            case L: {
                return "Pace of Tape";
            }
            case ha: {
                return "Market Speed";
            }
        }
        return "";
    }
}

