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
import ttw.tradefinder.Pc;
import ttw.tradefinder.af_0;
import ttw.tradefinder.ca_1;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.da_1;
import ttw.tradefinder.df_1;
import ttw.tradefinder.eC;
import ttw.tradefinder.eb_1;
import ttw.tradefinder.ed_2;
import ttw.tradefinder.fC;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.hb_0;
import ttw.tradefinder.hd;
import ttw.tradefinder.he_1;
import ttw.tradefinder.ib_0;
import ttw.tradefinder.l;
import ttw.tradefinder.lc_0;
import ttw.tradefinder.qc_0;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sf_1;
import ttw.tradefinder.tb_0;
import ttw.tradefinder.ub;
import ttw.tradefinder.v_0;
import ttw.tradefinder.yb_0;
import ttw.tradefinder.za_1;
import velox.api.layer1.messages.indicators.StrategyUpdateGeneratorFilter;

/*
 * Renamed from ttw.tradefinder.vF
 */
public class vf_1
implements r_0 {
    public static final String C = "TTW-LiquidityTracker";
    private final ff_1 M;
    private final gd_0 b;
    private final sf_1 c;

    @Override
    public /* synthetic */ String j() {
        vf_1 a2;
        return a2.H();
    }

    @Override
    public /* synthetic */ cc_0 E() {
        return new cc_0("Sample", "184.3", af_0.B, null, Collections.emptyList(), null);
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ Color j() {
        vf_1 a2;
        switch (a2.M) {
            case Ha: {
                return he_1.K;
            }
        }
        return Color.WHITE;
    }

    @Override
    public /* synthetic */ Color d() {
        return Color.WHITE;
    }

    @Override
    public /* synthetic */ Set<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> E() {
        HashSet<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> hashSet = new HashSet<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType>();
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.TRADES);
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.DEPTH_MBP);
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.INSTRUMENTS);
        return hashSet;
    }

    public /* synthetic */ vf_1(gd_0 a2, ff_1 a3, sf_1 a4) {
        vf_1 a5;
        vf_1 vf_12 = a5;
        a5.b = a2;
        vf_12.M = a3;
        vf_12.c = a4;
    }

    @Override
    public /* synthetic */ String g() {
        vf_1 a2;
        return a2.l();
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String C() {
        vf_1 a2;
        switch (a2.M) {
            case Ha: {
                return "Bid Dynamics";
            }
        }
        return "";
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ v_0 E() {
        vf_1 a2;
        switch (a2.M) {
            case G: 
            case S: 
            case N: 
            case M: 
            case n: 
            case D: 
            case o: 
            case Ha: 
            case C: {
                return a2.b;
            }
        }
        return null;
    }

    @Override
    public /* synthetic */ String a() {
        vf_1 a2;
        return a2.C();
    }

    @Override
    public /* synthetic */ da_1 E() {
        return new da_1();
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String H() {
        vf_1 a2;
        switch (a2.M) {
            case Ha: {
                return "Price Dynamics Zero Line";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ l a(qc_1 a2) {
        vf_1 a3;
        switch (a3.M) {
            case G: 
            case S: 
            case N: 
            case M: 
            case n: 
            case D: 
            case o: 
            case Ha: 
            case C: 
            case y: {
                return new Pc(a3.d(), Arrays.asList(cd.A, cd.C, cd.c, cd.D), a2);
            }
        }
        return new hb_0();
    }

    @Override
    public /* synthetic */ ib_0 E() {
        return new ib_0();
    }

    public /* synthetic */ sf_1 E() {
        vf_1 a2;
        return a2.c;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String A() {
        vf_1 a2;
        switch (a2.M) {
            case G: {
                return "Ask Liquidity Added";
            }
            case S: {
                return "Ask Liquidity Removed";
            }
            case n: {
                return "Ask Liquidity Change";
            }
            case N: {
                return "Bid Liquidity Added";
            }
            case M: {
                return "Bid Liquidity Removed";
            }
            case D: {
                return "Bid Liquidity Change";
            }
            case o: {
                return "Average Liquidity";
            }
            case Ha: {
                return "Price Dynamics";
            }
            case C: {
                return "Price Dynamics Plot";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ l j(qc_1 a2) {
        return new Pc("strategy", Arrays.asList(cd.A, cd.C, cd.c, cd.D), a2);
    }

    @Override
    public /* synthetic */ ff_1 E() {
        vf_1 a2;
        return a2.M;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String E() {
        vf_1 a2;
        switch (a2.c) {
            case w: {
                return "Telegram Notifications";
            }
            case I: {
                return "Relative Liquidity Change Alerts";
            }
            case C: {
                return "Absolute Liquidity Change Alerts";
            }
            case k: {
                return "Average Volume/Liquidity Display";
            }
            case X: {
                return "Current Average Liquidity";
            }
            case J: {
                return "Current Average Volume";
            }
            case i: {
                return "Price Dynamics";
            }
            case g: {
                return "Price Dynamics Plot";
            }
        }
        return "";
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String d() {
        vf_1 a2;
        switch (a2.M) {
            case G: 
            case N: {
                return a2.A() + ".relative.add";
            }
            case S: 
            case M: {
                return a2.A() + ".relative.remove";
            }
            case n: 
            case D: {
                return a2.A() + ".absolute";
            }
        }
        return a2.A();
    }

    @Override
    public /* synthetic */ String f() {
        return "TTW-LiquidityTracker";
    }

    @Override
    public /* synthetic */ tb_0 E() {
        vf_1 a2;
        switch (a2.M) {
            case Ha: {
                return new tb_0(2, eb_1.M);
            }
        }
        return new tb_0();
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ Color a() {
        vf_1 a2;
        switch (a2.M) {
            case Ha: {
                return he_1.H;
            }
        }
        return Color.WHITE;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ Color E() {
        vf_1 a2;
        switch (a2.M) {
            case Ha: {
                return he_1.a;
            }
        }
        return Color.WHITE;
    }

    @Override
    public /* synthetic */ fC E() {
        vf_1 a2;
        switch (a2.M) {
            case G: {
                return new fC(eC.H, Ic.b, Color.decode("#ff9696"), lc_0.C, df_1.b, 12);
            }
            case S: {
                return new fC(eC.H, Ic.b, Color.decode("#ff9696"), lc_0.C, df_1.b, 12);
            }
            case N: {
                return new fC(eC.H, Ic.b, Color.decode("#c8ffc8"), lc_0.C, df_1.b, 12);
            }
            case M: {
                return new fC(eC.H, Ic.b, Color.decode("#c8ffc8"), lc_0.C, df_1.b, 12);
            }
            case n: {
                return new fC(eC.c, Ic.H, Color.decode("#ff7878"), lc_0.C, df_1.b, 15);
            }
            case D: {
                return new fC(eC.c, Ic.H, Color.decode("#96ff96"), lc_0.C, df_1.b, 15);
            }
        }
        return new fC();
    }

    @Override
    public /* synthetic */ l E(qc_1 a2) {
        vf_1 a3;
        switch (a3.c) {
            case w: 
            case I: 
            case C: 
            case k: 
            case X: 
            case J: 
            case i: 
            case g: {
                return new Pc(a3.c.toString(), Arrays.asList(cd.A, cd.C, cd.c, cd.D), a2);
            }
        }
        return new hb_0();
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String l() {
        vf_1 a2;
        switch (a2.M) {
            case Ha: {
                return "Ask Dynamics";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ ca_1 E() {
        vf_1 a2;
        if (a2.M == ff_1.C) {
            return new ca_1(he_1.b, he_1.M, he_1.D, yb_0.c, qc_0.M, hd.b, za_1.M, 10, 20, 10);
        }
        return new ca_1();
    }
}

