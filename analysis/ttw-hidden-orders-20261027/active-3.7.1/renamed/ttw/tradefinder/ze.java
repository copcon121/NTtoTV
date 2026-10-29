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
    public static final String b = re_1.E("OeL\u001cSX\u007fU~_TC\u007fTiB");
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

    public /* synthetic */ sf_1 ttw_tradefinder_sf_1_E() {
        ze a2;
        return a2.c;
    }

    @Override
    public /* synthetic */ String java_lang_String_j() {
        return "";
    }

    @Override
    public /* synthetic */ cc_0 ttw_tradefinder_cc_0_E() {
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
        return new cc_0(re_1.E("HPvAwT"), lD.E("C6F A"), af_0.B, null, Collections.emptyList(), null);
    }

    @Override
    public /* synthetic */ String java_lang_String_a() {
        return "";
    }

    @Override
    public /* synthetic */ String f() {
        return lD.E("Z&Y_F\u001bj\u0016k\u001cA\u0000j\u0017|\u0001");
    }

    @Override
    public /* synthetic */ Color java_awt_Color_d() {
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
    public /* synthetic */ Color java_awt_Color_a() {
        return Color.WHITE;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String java_lang_String_E() {
        ze a2;
        switch (a2.c) {
            case w: {
                return lD.E("Z\u0017b\u0017i\u0000o\u001f.<a\u0006g\u0014g\u0011o\u0006g\u001d`\u0001");
            }
            case B: {
                return re_1.E("yrU\u007fTu\u0011TC\u007fTi\u00113xxTyTiV2\u0011WXuT");
            }
            case a: {
                return lD.E(":g\u0016j\u0017`RA\u0000j\u0017|R&;m\u0017l\u0017|\u0015'R]\u001bi\u001co\u001e");
            }
            case N: {
                return re_1.E("SX\u007fU~_;~iU~C;\u0019RR~S~C|\u0018;ut\\");
            }
            case Y: {
                return lD.E("6w\u001co\u001fg\u0011.;m\u0017l\u0017|\u0015.6k\u0004k\u001ea\u0002c\u0017`\u0006");
            }
            case D: {
                return re_1.E("ub_z\\rR;yrU\u007fTu\u0011TC\u007fTi\u00113xxTyTiV2\u0011K]tE");
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
    public /* synthetic */ v_0 ttw_tradefinder_v_0_E() {
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
    public /* synthetic */ ca_1 ttw_tradefinder_ca_1_E() {
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
    public /* synthetic */ Color java_awt_Color_E() {
        return Color.WHITE;
    }

    @Override
    public /* synthetic */ String A() {
        ze a2;
        switch (a2.M) {
            case s: {
                while (false) {
                }
                return re_1.E("SX\u007fU~_;~iU~C;eiPxT");
            }
            case Ba: {
                return lD.E("F\u001bj\u0016k\u001c.=|\u0016k\u0000.6A?");
            }
            case P: {
                return re_1.E("SX\u007fU~_;phZ;~iU~C");
            }
            case u: {
                return lD.E("F\u001bj\u0016k\u001c.0g\u0016.=|\u0016k\u0000");
            }
            case t: {
                return re_1.E("yrU\u007fTu\u0011ZBp\u0011TC\u007fTi\u0011HX|_z]");
            }
            case m: {
                return lD.E(":g\u0016j\u0017`RL\u001bjRA\u0000j\u0017|R]\u001bi\u001co\u001e");
            }
            case U: {
                return re_1.E("ub_z\\rR;yrU\u007fTu\u0011TC\u007fTi\u0011K]tE");
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
    public /* synthetic */ ib_0 ttw_tradefinder_ib_0_E() {
        return new ib_0();
    }

    @Override
    public /* synthetic */ ff_1 ttw_tradefinder_ff_1_E() {
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
                return new Pc(a3.java_lang_String_d(), Arrays.asList(cd.h, cd.A, cd.C, cd.c, cd.D), a2);
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
    public /* synthetic */ fC ttw_tradefinder_fC_E() {
        return new fC();
    }

    @Override
    public /* synthetic */ Color java_awt_Color_j() {
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
    public /* synthetic */ String java_lang_String_d() {
        ze a2;
        return a2.A();
    }

    @Override
    public /* synthetic */ String H() {
        return "";
    }

    @Override
    public /* synthetic */ l j(qc_1 a2) {
        return new Pc(lD.E("}\u0006|\u0013z\u0017i\u000b"), Arrays.asList(cd.h, cd.A, cd.C, cd.c, cd.D), a2);
    }

    @Override
    public /* synthetic */ da_1 ttw_tradefinder_da_1_E() {
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
    public /* synthetic */ tb_0 ttw_tradefinder_tb_0_E() {
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

