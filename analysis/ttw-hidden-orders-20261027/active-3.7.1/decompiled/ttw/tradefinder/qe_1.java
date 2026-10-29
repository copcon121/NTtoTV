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
import ttw.tradefinder.Pc;
import ttw.tradefinder.af_0;
import ttw.tradefinder.ca_1;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.da_1;
import ttw.tradefinder.fC;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.ge_1;
import ttw.tradefinder.hb_0;
import ttw.tradefinder.ib_0;
import ttw.tradefinder.l;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sf_1;
import ttw.tradefinder.tb_0;
import ttw.tradefinder.v_0;
import ttw.tradefinder.wa_2;
import velox.api.layer1.messages.indicators.StrategyUpdateGeneratorFilter;

/*
 * Renamed from ttw.tradefinder.qe
 */
public class qe_1
implements r_0 {
    private final ff_1 M;
    public static final String b = wa_2.E("lMo4hkQz]XT|Jm");
    private final sf_1 c;

    @Override
    public /* synthetic */ ca_1 E() {
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
    public /* synthetic */ tb_0 E() {
        return new tb_0();
    }

    @Override
    public /* synthetic */ l j(qc_1 a2) {
        return new Pc(ge_1.E("{\bz\u001d|\u0019o\u0005"), Arrays.asList(cd.C, cd.c, cd.D), a2);
    }

    @Override
    public /* synthetic */ String d() {
        qe_1 a2;
        return a2.A();
    }

    @Override
    public /* synthetic */ Color j() {
        return Color.WHITE;
    }

    @Override
    public /* synthetic */ cc_0 E() {
        return new cc_0(wa_2.E("kxUiT|"), ge_1.E("M0H&O"), af_0.B, null, Collections.emptyList(), null);
    }

    @Override
    public /* synthetic */ Color d() {
        return Color.WHITE;
    }

    @Override
    public /* synthetic */ da_1 E() {
        return new da_1();
    }

    @Override
    public /* synthetic */ String E() {
        qe_1 a2;
        switch (a2.c) {
            case w: {
                while (false) {
                }
                return ge_1.E("\\\u0019d\u0019o\u000ei\u0011(2g\ba\u001aa\u001fi\ba\u0013f\u000f");
            }
            case c: {
                return wa_2.E("IJp[|\u0018XT|Jm");
            }
        }
        return "";
    }

    @Override
    public /* synthetic */ fC E() {
        return new fC();
    }

    @Override
    public /* synthetic */ ib_0 E() {
        return new ib_0();
    }

    @Override
    public /* synthetic */ v_0 E() {
        return null;
    }

    @Override
    public /* synthetic */ String a() {
        return "";
    }

    @Override
    public /* synthetic */ String g() {
        return "";
    }

    @Override
    public /* synthetic */ Color a() {
        return Color.WHITE;
    }

    @Override
    public /* synthetic */ boolean E() {
        return false;
    }

    public /* synthetic */ qe_1(ff_1 a2, sf_1 a3) {
        qe_1 a4;
        qe_1 qe_12 = a4;
        qe_12.M = a2;
        qe_12.c = a3;
    }

    @Override
    public /* synthetic */ l E(qc_1 a2) {
        qe_1 a3;
        switch (a3.c) {
            case w: 
            case c: {
                return new Pc(a3.c.toString(), Arrays.asList(cd.C, cd.c, cd.D), a2);
            }
        }
        return new hb_0();
    }

    @Override
    public /* synthetic */ String j() {
        return "";
    }

    @Override
    public /* synthetic */ String l() {
        return "";
    }

    @Override
    public /* synthetic */ Set<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> E() {
        HashSet<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType> hashSet = new HashSet<StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType>();
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.TRADES);
        hashSet.add(StrategyUpdateGeneratorFilter.StrategyUpdateGeneratorEventType.INSTRUMENTS);
        return hashSet;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String A() {
        qe_1 a2;
        switch (a2.M) {
            case O: {
                return wa_2.E("IJp[|\u0018XT|Jm");
            }
        }
        return "";
    }

    public /* synthetic */ sf_1 E() {
        qe_1 a2;
        return a2.c;
    }

    @Override
    public /* synthetic */ String f() {
        return ge_1.E("\\(_QX\u000ea\u001fm=d\u0019z\b");
    }

    @Override
    public /* synthetic */ ff_1 E() {
        qe_1 a2;
        return a2.M;
    }

    @Override
    public /* synthetic */ l a(qc_1 a2) {
        qe_1 a3;
        switch (a3.M) {
            case O: {
                return new Pc(a3.d(), Arrays.asList(cd.C, cd.c, cd.D), a2);
            }
            case y: {
                return new Pc(a3.M.toString(), Arrays.asList(cd.C, cd.c, cd.D), a2);
            }
        }
        return new hb_0();
    }

    @Override
    public /* synthetic */ boolean j() {
        return false;
    }

    @Override
    public /* synthetic */ String H() {
        return "";
    }
}

