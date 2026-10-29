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
import ttw.tradefinder.fC;
import ttw.tradefinder.ff_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.fg;
import ttw.tradefinder.hb_0;
import ttw.tradefinder.he_1;
import ttw.tradefinder.ib_0;
import ttw.tradefinder.l;
import ttw.tradefinder.lc_0;
import ttw.tradefinder.pb_2;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sf_1;
import ttw.tradefinder.tb_0;
import ttw.tradefinder.v_0;
import velox.api.layer1.messages.indicators.StrategyUpdateGeneratorFilter;

/*
 * Renamed from ttw.tradefinder.ud
 */
public class ud_1
implements r_0 {
    public static final String C = "TTW-ImbalanceTracker";
    private final sf_1 M;
    private final ff_1 b;
    private final fg c;

    @Override
    public /* synthetic */ l j(qc_1 a2) {
        return new Pc("strategy", Arrays.asList(cd.C, cd.c, cd.D), a2);
    }

    @Override
    public /* synthetic */ String j() {
        ud_1 a2;
        switch (a2.b) {
            case J: {
                while (false) {
                }
                return a2.H() + "1";
            }
            case V: {
                return a2.H() + "2";
            }
        }
        return "";
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String l() {
        ud_1 a2;
        switch (a2.b) {
            case J: 
            case V: {
                return "Ask Imbalance";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ Set<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> E() {
        HashSet<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> hashSet = new HashSet<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType>();
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.DEPTH_MBP);
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.INSTRUMENTS);
        return hashSet;
    }

    @Override
    public /* synthetic */ Color E() {
        ud_1 a2;
        switch (a2.b) {
            case J: {
                while (false) {
                }
                return he_1.M;
            }
            case V: {
                return he_1.c;
            }
        }
        return Color.WHITE;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String E() {
        ud_1 a2;
        switch (a2.M) {
            case w: {
                return "Telegram Notifications";
            }
            case n: {
                return "Imbalance Line";
            }
            case b: {
                return "Imbalance Line 2";
            }
            case L: {
                return "Imbalance Signal";
            }
            case Z: {
                return "Imbalance Alerts Below";
            }
            case H: {
                return "Imbalance zero-cross Signal";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ ib_0 E() {
        return new ib_0();
    }

    @Override
    public /* synthetic */ String a() {
        ud_1 a2;
        switch (a2.b) {
            case J: {
                while (false) {
                }
                return a2.C() + "1";
            }
            case V: {
                return a2.C() + "2";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ String g() {
        ud_1 a2;
        switch (a2.b) {
            case J: {
                while (false) {
                }
                return a2.l() + "1";
            }
            case V: {
                return a2.l() + "2";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ String d() {
        ud_1 a2;
        switch (a2.b) {
            case c: 
            case r: {
                while (false) {
                }
                return a2.A() + ".above";
            }
            case A: 
            case F: {
                return a2.A() + ".zerocross";
            }
        }
        return a2.A();
    }

    @Override
    public /* synthetic */ Color j() {
        ud_1 a2;
        switch (a2.b) {
            case J: {
                while (false) {
                }
                return he_1.b;
            }
            case V: {
                return he_1.j;
            }
        }
        return Color.WHITE;
    }

    @Override
    public /* synthetic */ Color a() {
        ud_1 a2;
        switch (a2.b) {
            case J: {
                while (false) {
                }
                return he_1.H;
            }
            case V: {
                return he_1.H;
            }
        }
        return Color.WHITE;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String H() {
        ud_1 a2;
        switch (a2.b) {
            case J: 
            case V: {
                return "Imbalance Zero Line";
            }
        }
        return "";
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String A() {
        ud_1 a2;
        switch (a2.b) {
            case c: 
            case A: {
                return "Ask Imbalance";
            }
            case r: 
            case F: {
                return "Bid Imbalance";
            }
            case J: {
                return "Imbalance Line";
            }
            case V: {
                return "Imbalance Line 2";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ ff_1 E() {
        ud_1 a2;
        return a2.b;
    }

    @Override
    public /* synthetic */ l E(qc_1 a2) {
        ud_1 a3;
        switch (a3.M) {
            case w: 
            case n: 
            case L: 
            case Z: 
            case H: {
                return new Pc(a3.M.toString(), Arrays.asList(cd.C, cd.c, cd.D), a2);
            }
            case b: {
                return new Pc(a3.M.toString(), Collections.emptyList(), a2);
            }
        }
        return new hb_0();
    }

    @Override
    public /* synthetic */ Color d() {
        return Color.WHITE;
    }

    @Override
    public /* synthetic */ fC E() {
        ud_1 a2;
        switch (a2.b) {
            case c: {
                return new fC(eC.C, Ic.b, he_1.b, lc_0.A, df_1.b, 12);
            }
            case r: {
                return new fC(eC.b, Ic.b, he_1.M, lc_0.M, df_1.b, 12);
            }
            case A: {
                return new fC(eC.A, Ic.H, he_1.j, lc_0.D, df_1.b, 15);
            }
            case F: {
                return new fC(eC.A, Ic.H, he_1.c, lc_0.b, df_1.b, 15);
            }
        }
        return new fC();
    }

    @Override
    public /* synthetic */ tb_0 E() {
        ud_1 a2;
        switch (a2.b) {
            case J: {
                return new tb_0(3, eb_1.M);
            }
            case V: {
                return new tb_0(3, eb_1.M);
            }
        }
        return new tb_0();
    }

    @Override
    public /* synthetic */ cc_0 E() {
        return new cc_0("Sample", "184.3", af_0.B, null, Collections.emptyList(), null);
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ v_0 E() {
        ud_1 a2;
        switch (a2.b) {
            case c: 
            case r: 
            case A: 
            case F: 
            case J: 
            case V: {
                return a2.c;
            }
        }
        return null;
    }

    @Override
    public /* synthetic */ String f() {
        return "TTW-ImbalanceTracker";
    }

    public /* synthetic */ ud_1(fg a2, ff_1 a3, sf_1 a4) {
        ud_1 a5;
        ud_1 ud_12 = a5;
        a5.c = a2;
        ud_12.b = a3;
        ud_12.M = a4;
    }

    @Override
    public /* synthetic */ da_1 E() {
        return new da_1();
    }

    public /* synthetic */ sf_1 E() {
        ud_1 a2;
        return a2.M;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String C() {
        ud_1 a2;
        switch (a2.b) {
            case J: 
            case V: {
                return "Bid Imbalance";
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ ca_1 E() {
        return new ca_1();
    }

    @Override
    public /* synthetic */ l a(qc_1 a2) {
        ud_1 a3;
        switch (a3.b) {
            case c: 
            case r: 
            case A: 
            case F: 
            case J: {
                return new Pc(a3.d(), Arrays.asList(cd.C, cd.c, cd.D), a2);
            }
            case V: {
                return new Pc(a3.d(), Collections.emptyList(), a2);
            }
            case y: {
                return new Pc(a3.b.toString(), Arrays.asList(cd.C, cd.c, cd.D), a2);
            }
        }
        return new hb_0();
    }
}

