/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.TradeInfo
 *  velox.api.layer1.simplified.Intervals
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import ttw.tradefinder.Ff;
import ttw.tradefinder.Jd;
import ttw.tradefinder.K;
import ttw.tradefinder.Ob;
import ttw.tradefinder.Pc;
import ttw.tradefinder.U;
import ttw.tradefinder.Wa;
import ttw.tradefinder.b;
import ttw.tradefinder.bf_2;
import ttw.tradefinder.cd;
import ttw.tradefinder.cd_2;
import ttw.tradefinder.cf_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ep;
import ttw.tradefinder.fR;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.fu;
import ttw.tradefinder.g;
import ttw.tradefinder.gd_2;
import ttw.tradefinder.h;
import ttw.tradefinder.hg_0;
import ttw.tradefinder.i;
import ttw.tradefinder.if_0;
import ttw.tradefinder.iy;
import ttw.tradefinder.kc_2;
import ttw.tradefinder.kd_1;
import ttw.tradefinder.kf_0;
import ttw.tradefinder.le_1;
import ttw.tradefinder.lg_0;
import ttw.tradefinder.n_0;
import ttw.tradefinder.nd_2;
import ttw.tradefinder.ne_0;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.pa_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ra;
import ttw.tradefinder.re_1;
import ttw.tradefinder.s_0;
import ttw.tradefinder.sa_0;
import ttw.tradefinder.ta_0;
import ttw.tradefinder.ua;
import ttw.tradefinder.ve_0;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.wb_2;
import ttw.tradefinder.wd_2;
import ttw.tradefinder.x_0;
import ttw.tradefinder.xa_0;
import ttw.tradefinder.xf_0;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.y_0;
import ttw.tradefinder.ze_2;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.simplified.Intervals;

/*
 * Renamed from ttw.tradefinder.Gd
 */
public class gd_1
extends kc_2
implements y_0,
x_0,
n_0,
U {
    private xf_0 x;
    private static final int W = 4;
    private List<lg_0> s;
    private nd_2 n;
    private final cf_2 T;
    private static final int Y = 2;
    private static final int R = 2;
    private final df_0<xa_0, i> N;
    private boolean w;
    private static final int V = 1;
    private final K U;
    private final df_0<pa_0, fu> Z;
    private final le_1 u;
    private static final int z = 3;
    private lg_0 X;
    private static final int Q = 10;
    private static final int g = 60;
    private int L;
    private gd_2 l;
    private xf_0 m;
    private ne_0 I;
    private kf_0 f;
    private re_1 F;
    private final le_1 J;
    private final df_0<ua, ep> G;
    private final df_0<sa_0, h> d;
    private xf_0 i;
    private final K e;
    private re_1 k;
    private final df_0<Wa, iy> B;
    private xf_0 K;
    private final df_0<Ob, fR> E;
    private final df_0<ra, b> j;
    private int a;
    private ve_0 h;
    private int H;
    private nd_2 D;
    private final df_0<ta_0, g> A;
    private final df_0<Wa, iy> C;
    private kd_1 M;
    private long b;
    private boolean c;

    @Override
    public /* synthetic */ void E(lg_0 a2) {
        gd_1 a3;
        if (a2.a() >= ((pa_0)a3.Z.M).H && ((ze_2)((Object)a3.M)).double_E(a2.j()) >= ((pa_0)a3.Z.M).c) {
            int n2;
            lg_0 lg_02;
            ff_1 ff_12;
            if (a2.D) {
                ff_12 = ff_1.ia;
                lg_02 = a2;
            } else {
                ff_12 = ff_1.B;
                lg_02 = a2;
            }
            gd_1 gd_12 = a3;
            a3.j(ff_12, lg_02.c, a2.E((ze_2)((Object)gd_12.M), gd_12.e.boolean_j() && ((pa_0)a3.Z.M).C == df_1.c), a2.h, a3.b);
            if (a2.C && a3.e.boolean_j() && (n2 = a3.M.E(a2.M)) != -1) {
                a3.j(ff_1.d, new Ff(a2, a3.M.long_E(n2), a3.M.int_E(n2)));
            }
            if (a3.w && a3.c && ((pa_0)a3.Z.M).M) {
                if (((pa_0)a3.Z.M).b.boolean_E()) {
                    gd_1 gd_13 = a3;
                    a3.D.E(a2.E((ze_2)((Object)gd_13.M), ((pa_0)gd_13.Z.M).b));
                }
                if (((pa_0)a3.Z.M).A == df_1.c) {
                    gd_1 gd_14 = a3;
                    gd_14.D.j(((ze_2)((Object)gd_14.M)).M, a2.E((ze_2)((Object)a3.M)));
                }
                if (((pa_0)a3.Z.M).D == df_1.c) {
                    gd_1 gd_15 = a3;
                    if (gd_15.U.E(((ze_2)((Object)gd_15.M)).j)) {
                        lg_0 lg_03;
                        bf_2 bf_22;
                        cf_2 cf_22 = a3.T;
                        if (a2.D) {
                            bf_22 = bf_2.b;
                            lg_03 = a2;
                        } else {
                            bf_22 = bf_2.c;
                            lg_03 = a2;
                        }
                        cf_22.E(hg_0.H, bf_22, lg_03.E((ze_2)((Object)a3.M)));
                    }
                }
            }
        }
    }

    private /* synthetic */ void g(long a2) {
        double d2;
        gd_1 a3;
        long l2 = (long)((double)a2 - ((ua)a3.G.M).a * 1.0E9);
        gd_1 gd_12 = a3;
        if (a3.I.E(l2, gd_12.h, ((ua)gd_12.G.M).D, ((ua)a3.G.M).j)) {
            double d3;
            d2 = Math.abs(a3.I.double_E());
            if (d3 >= 1.0 && d2 >= ((ua)a3.G.M).c) {
                gd_1 gd_13 = a3;
                gd_1 gd_14 = a3;
                gd_13.j(ff_1.v, gd_13.I.int_E(), gd_14.I.ttw_tradefinder_cc_0_E((ze_2)((Object)gd_14.M)), a3.I.long_E(), a3.b);
                if (gd_13.w && a3.c && ((ua)a3.G.M).C) {
                    if (((ua)a3.G.M).H.boolean_E()) {
                        gd_1 gd_15 = a3;
                        gd_1 gd_16 = a3;
                        gd_15.D.E(gd_15.I.E((ze_2)((Object)gd_16.M), ((ua)gd_16.G.M).H));
                    }
                    if (((ua)a3.G.M).b == df_1.c) {
                        gd_1 gd_17 = a3;
                        gd_1 gd_18 = a3;
                        gd_17.D.j(((ze_2)((Object)gd_17.M)).M, gd_18.I.java_lang_String_E((ze_2)((Object)gd_18.M)));
                    }
                    if (((ua)a3.G.M).M == df_1.c) {
                        gd_1 gd_19 = a3;
                        if (gd_19.U.E(((ze_2)((Object)gd_19.M)).j)) {
                            gd_1 gd_110 = a3;
                            a3.T.E(hg_0.A, bf_2.c, gd_110.I.E((ze_2)((Object)gd_110.M)));
                        }
                    }
                }
            }
            a3.I.void_E(a2);
        }
        gd_1 gd_111 = a3;
        if (a3.h.E(l2, gd_111.I, ((ua)gd_111.G.M).D, ((ua)a3.G.M).j)) {
            double d4;
            d2 = Math.abs(a3.h.double_E());
            if (d4 >= 1.0 && d2 >= ((ua)a3.G.M).c) {
                gd_1 gd_112 = a3;
                gd_1 gd_113 = a3;
                gd_112.j(ff_1.ga, gd_112.h.int_E(), gd_113.h.ttw_tradefinder_cc_0_E((ze_2)((Object)gd_113.M)), a3.h.long_E(), a3.b);
                if (gd_112.w && a3.c && ((ua)a3.G.M).C) {
                    if (((ua)a3.G.M).H.boolean_E()) {
                        gd_1 gd_114 = a3;
                        gd_1 gd_115 = a3;
                        gd_114.D.E(gd_114.h.E((ze_2)((Object)gd_115.M), ((ua)gd_115.G.M).H));
                    }
                    if (((ua)a3.G.M).b == df_1.c) {
                        gd_1 gd_116 = a3;
                        gd_1 gd_117 = a3;
                        gd_116.D.j(((ze_2)((Object)gd_116.M)).M, gd_117.h.java_lang_String_E((ze_2)((Object)gd_117.M)));
                    }
                    if (((ua)a3.G.M).M == df_1.c) {
                        gd_1 gd_118 = a3;
                        if (gd_118.U.E(((ze_2)((Object)gd_118.M)).j)) {
                            gd_1 gd_119 = a3;
                            a3.T.E(hg_0.A, bf_2.b, gd_119.h.E((ze_2)((Object)gd_119.M)));
                        }
                    }
                }
            }
            a3.h.void_E(a2);
        }
    }

    @Override
    public /* synthetic */ void void_E() {
        gd_1 gd_12;
        gd_1 a2;
        gd_1 gd_13 = a2;
        gd_1 gd_14 = a2;
        super.void_E();
        gd_14.I.void_E(0L);
        gd_14.h.void_E(0L);
        gd_14.k.j();
        gd_14.F.j();
        gd_14.l.E();
        gd_14.i.E(60);
        gd_14.x.E(60);
        gd_13.M.void_a();
        a2.X = null;
        gd_13.J.void_E();
        a2.u.void_E();
        a2.L = 0;
        a2.H = 0;
        gd_1 gd_15 = a2;
        if (a2.e.boolean_j()) {
            gd_15.K.E(((xa_0)a2.N.M).c);
            gd_1 gd_16 = a2;
            gd_16.m.E(((xa_0)gd_16.N.M).c);
            gd_12 = a2;
        } else {
            gd_15.K.E(10);
            gd_1 gd_17 = a2;
            gd_12 = gd_17;
            gd_17.m.E(10);
        }
        gd_12.c = false;
    }

    private /* synthetic */ void f(long a22) {
        gd_1 a3;
        gd_1 gd_12 = a3;
        double d2 = gd_12.m.E(a22);
        d2 = gd_12.K.E(a22) - d2;
        gd_12.E(ff_1.h, (Double)d2, a22);
        if (!gd_12.e.boolean_j()) {
            return;
        }
        wd_2 a22 = a3.l.E(a22, d2, a3.a);
        if (a22 != null) {
            a3.E(a22);
        }
    }

    public /* synthetic */ void E(wd_2 a2) {
        wd_2 wd_22;
        ff_1 ff_12;
        gd_1 a3;
        gd_1 gd_12 = a3;
        String string = ((ze_2)((Object)gd_12.M)).java_lang_String_j(a2.b);
        if (a2.D) {
            ff_12 = ff_1.Ka;
            wd_22 = a2;
        } else {
            ff_12 = ff_1.k;
            wd_22 = a2;
        }
        gd_12.j(ff_12, wd_22.b, new Jd(string, ((ze_2)((Object)a3.M)).java_lang_String_E(a2.A), a2.M), a2.C, a2.c);
        if (a3.w && a3.c && ((xa_0)a3.N.M).D) {
            gd_1 gd_13 = a3;
            String string2 = ((ze_2)((Object)gd_13.M)).java_lang_String_E(a2.A);
            if (((xa_0)gd_13.N.M).A.boolean_E()) {
                gd_1 gd_14 = a3;
                gd_14.D.E(((xa_0)gd_14.N.M).A.E(((ze_2)((Object)a3.M)).D, "Volume Stop " + (a2.D ? Ff.E("'G\u0018N") : wa_2.java_lang_String_E("[M`")), string2, string, a2.D));
            }
            if (((xa_0)a3.N.M).C == df_1.c) {
                gd_1 gd_15 = a3;
                gd_15.D.j(((ze_2)((Object)gd_15.M)).M, String.format(Ff.E("\"M\u0018W\u0019GTq\u0000M\u0004\u0002QQTM\u0012\u0002QQTP\u0011C\u0017J\u0011FTC\u0000\u0002QQ"), a2.D ? wa_2.java_lang_String_E("k\\tU") : Ff.E("`!{"), string2, string));
            }
            if (((xa_0)a3.N.M).b == df_1.c) {
                gd_1 gd_16 = a3;
                if (gd_16.U.E(((ze_2)((Object)gd_16.M)).j)) {
                    gd_1 gd_17;
                    bf_2 bf_22;
                    cf_2 cf_22 = a3.T;
                    if (a2.D) {
                        bf_22 = bf_2.b;
                        gd_17 = a3;
                    } else {
                        bf_22 = bf_2.c;
                        gd_17 = a3;
                    }
                    cf_22.E(hg_0.k, bf_22, gd_17.E(string2, string));
                }
            }
        }
    }

    @Override
    public /* synthetic */ void E(long a2, int a3, int a4, TradeInfo a5) {
        gd_1 a6;
        a6.b = a2;
        a6.f.void_E(a2, a3, a4, a5);
        if (a4 <= 0) {
            return;
        }
        if (a6.a != a3) {
            ++a6.L;
        }
        a6.a = a3;
        double d2 = ((ze_2)((Object)a6.M)).double_E(a4);
        if (a5.isBidAggressor) {
            gd_1 gd_12 = a6;
            gd_12.i.E(a2, d2);
            gd_12.I.E(a2, a3, d2);
            gd_12.D.E(a2, a3, d2);
            return;
        }
        gd_1 gd_13 = a6;
        gd_13.x.E(a2, d2);
        gd_13.h.E(a2, a3, d2);
        gd_13.n.E(a2, a3, d2);
    }

    @Override
    public /* synthetic */ void d(long a2) {
        gd_1 a3;
        a3.l(a2);
    }

    private /* synthetic */ Map<String, String> E(String a2, String a3) {
        HashMap<String, String> hashMap = new HashMap<String, String>();
        hashMap.put(wa_2.java_lang_String_E("]]uLx"), a2);
        hashMap.put(Ff.E("r\u0006K\u0017G"), a3);
        return hashMap;
    }

    @Override
    public /* synthetic */ void E(long a2, int a3) {
        gd_1 a4;
        if (a3 == 2) {
            gd_1 gd_12 = a4;
            gd_12.A(a2);
            gd_12.f(a2);
            return;
        }
        if (a3 == 1) {
            gd_1 gd_13 = a4;
            gd_13.g(a2);
            gd_13.a(a2);
            return;
        }
        if (a3 == 3) {
            if (a4.e.boolean_j()) {
                gd_1 gd_14 = a4;
                a4.J.j(gd_14.H);
                gd_14.u.j(a4.L);
                a4.H = 0;
                a4.L = 0;
                gd_1 gd_15 = a4;
                a4.E(ff_1.L, Double.valueOf(gd_15.J.int_E()), a2);
                gd_15.E(ff_1.ha, Double.valueOf(a4.u.int_E()), a2);
                return;
            }
        } else if (a3 == 4) {
            if (a4.X == null) {
                return;
            }
            if (!a4.f.boolean_E()) {
                return;
            }
            gd_1 gd_16 = a4;
            gd_16.M.E(gd_16.X.M, a4.X.h, a4.X.c);
        }
    }

    public /* synthetic */ gd_1(String a2, f_0 a3, ze_2 a4, xf_2 a5, s_0 a6) {
        gd_1 a7;
        gd_1 gd_12 = a7;
        f_0 f_02 = a3;
        gd_1 gd_13 = a7;
        gd_1 gd_14 = a7;
        gd_1 gd_15 = a7;
        gd_1 gd_16 = a7;
        gd_1 gd_17 = a7;
        gd_1 gd_18 = a7;
        super(a3, a4, a6);
        a7.M = new kd_1(60000);
        a7.I = new ne_0();
        a7.h = new ve_0();
        a7.D = new nd_2(false, 2);
        a7.n = new nd_2(true, 2);
        a7.i = new xf_0();
        a7.x = new xf_0();
        gd_18.K = new xf_0();
        gd_18.m = new xf_0();
        gd_18.f = null;
        gd_17.k = null;
        gd_17.F = null;
        gd_16.l = null;
        gd_16.s = new ArrayList<lg_0>();
        gd_16.w = false;
        gd_15.c = false;
        gd_15.a = 0;
        gd_14.b = 0L;
        gd_14.X = null;
        gd_13.L = 0;
        gd_13.H = 0;
        a7.T = a7.ttw_tradefinder_cf_2_E();
        a7.G = a3.E((String)a2, a4.M, new ua(a4.A));
        a7.G.E(a7);
        a7.Z = a3.E((String)a2, a4.M, new pa_0(a4.A));
        a7.Z.E(a7);
        a7.j = a3.E((String)a2, a4.M, new ra(a4.A));
        a7.j.E(a7);
        a7.E = f_02.E((String)a2, a4.M, new Ob(a4.A));
        a7.E.E(a7);
        a7.C = f_02.E((String)a2, a4.M, wa_2.java_lang_String_E("("), new Wa(a4.A));
        a7.B = a3.E((String)a2, a4.M, Ff.E("\u0010"), new Wa(a4.A));
        a7.C.E(a7);
        a7.B.E(a7);
        a7.N = a3.E((String)a2, a4.M, new xa_0(a4.A));
        a7.N.E(a7);
        a7.A = a3.E((String)a2, a4.M, new ta_0());
        gd_12.A.E(a7);
        gd_12.d = a3.E((String)a2, a4.M, new sa_0());
        gd_12.d.E(a7);
        a7.J = new le_1(((sa_0)a7.d.M).C << 1);
        a7.u = new le_1(((sa_0)a7.d.M).A << 1);
        gd_1 gd_19 = a7;
        a7.f = new kf_0(a7, a4);
        gd_19.k = new re_1(a7.C);
        a7.F = new re_1(a7.B);
        gd_19.l = new gd_2(((xa_0)a7.N.M).M);
        a2 = new Pc(wa_2.java_lang_String_E("TYkS|LXT|JmKT]jK|V~]k"), Arrays.asList(cd.A, cd.C, cd.c, cd.D), a3.ttw_tradefinder_qc_1_E());
        gd_1 gd_110 = a7;
        gd_110.U = a2.E(null);
        a2 = new Pc(Ff.E("o\u0015P\u001fG\u0000c\u0018G\u0006V\u0007f\u0011T"), Collections.emptyList(), a3.ttw_tradefinder_qc_1_E());
        gd_110.e = a2.E(new wb_2(a7));
        gd_110.w = a3.boolean_j();
        gd_110.c = false;
        gd_110.f.void_E();
        gd_110.a(ff_1.v);
        gd_110.a(ff_1.ga);
        gd_110.a(ff_1.Ga);
        gd_110.a(ff_1.R);
        gd_110.a(ff_1.I);
        gd_110.a(ff_1.da);
        gd_110.a(ff_1.Ca);
        gd_110.a(ff_1.k);
        gd_110.a(ff_1.Ka);
        gd_110.a(ff_1.B);
        gd_110.a(ff_1.ia);
        gd_110.a(ff_1.Q);
        gd_110.a(ff_1.f);
        gd_110.a(ff_1.i);
        gd_110.a(ff_1.q);
        gd_110.a(ff_1.h);
        gd_110.a(ff_1.d);
        gd_110.a(ff_1.L);
        gd_110.a(ff_1.ha);
        gd_110.void_E();
        gd_110.E(new cd_2(cd_2.h, a7, 2));
        gd_110.E(new cd_2(cd_2.M, a7, 1));
        gd_110.E(new cd_2(cd_2.a, a7, 3));
        gd_110.E(new cd_2(cd_2.H, a7, 4));
    }

    public /* synthetic */ void E(wd_2 a2, ff_1 a3, df_0<Wa, iy> a4) {
        gd_1 a5;
        gd_1 gd_12 = a5;
        String string = ((ze_2)((Object)gd_12.M)).java_lang_String_j(a2.b);
        gd_12.j((ff_1)((Object)a3), a2.b, new Jd(string, ((ze_2)((Object)a5.M)).java_lang_String_E(a2.A), a2.M), a2.C, a2.c);
        if (gd_12.w && a5.c && ((Wa)a4.M).H) {
            a3 = ((ze_2)((Object)a5.M)).java_lang_String_E(a2.A);
            if (((Wa)a4.M).M.boolean_E()) {
                a5.D.E(((Wa)a4.M).M.E(((ze_2)((Object)a5.M)).D, "Market Volume Stop " + (a2.D ? wa_2.java_lang_String_E("k|Tu") : Ff.E("`\u0001[")), (String)a3, string, a2.D));
            }
            if (((Wa)a4.M).b == df_1.c) {
                gd_1 gd_13 = a5;
                gd_13.D.j(((ze_2)((Object)gd_13.M)).M, String.format(wa_2.java_lang_String_E("TYkS|L9nvTlU|\u0018JLvH9\u001dj\u0018v^9\u001dj\u0018k]x[q]}\u0018xL9\u001dj"), a2.D ? Ff.E("'g8n") : wa_2.java_lang_String_E("[m@"), a3, string));
            }
            if (((Wa)a4.M).c == df_1.c) {
                gd_1 gd_14 = a5;
                if (gd_14.U.E(((ze_2)((Object)gd_14.M)).j)) {
                    gd_1 gd_15;
                    bf_2 bf_22;
                    cf_2 cf_22 = a5.T;
                    if (a2.D) {
                        bf_22 = bf_2.b;
                        gd_15 = a5;
                    } else {
                        bf_22 = bf_2.c;
                        gd_15 = a5;
                    }
                    cf_22.E(hg_0.M, bf_22, gd_15.E((String)a3, string));
                }
            }
        }
    }

    @Override
    public /* synthetic */ void E(long a2, String a3) {
        gd_1 a4;
        a4.b = a2;
        a4.f.E(a2, a3);
    }

    @Override
    public /* synthetic */ void j(lg_0 a2) {
        gd_1 a3;
        lg_0 lg_02 = a2;
        ++a3.H;
        a3.a(lg_02);
        if (lg_02.C) {
            if (a2.D) {
                gd_1 gd_12 = a3;
                gd_12.m.E(gd_12.b, ((ze_2)((Object)a3.M)).double_E(a2.j()));
                return;
            }
            gd_1 gd_13 = a3;
            gd_13.K.E(gd_13.b, ((ze_2)((Object)a3.M)).double_E(a2.j()));
            return;
        }
        a3.X = a2;
    }

    @Override
    public /* synthetic */ boolean E(ff_1 a2, oe_1 a3) {
        gd_1 a4;
        if (a3 == oe_1.M) {
            if (a2 == ff_1.v || a2 == ff_1.ga) {
                return ((ua)a4.G.M).C;
            }
            if (a2 == ff_1.B || a2 == ff_1.ia) {
                return ((pa_0)a4.Z.M).M;
            }
            if (a2 == ff_1.Q || a2 == ff_1.f) {
                return ((ra)a4.j.M).A;
            }
            if (a2 == ff_1.i || a2 == ff_1.q) {
                return ((Ob)a4.E.M).M;
            }
            if (a2 == ff_1.R || a2 == ff_1.I) {
                return ((Wa)a4.C.M).H;
            }
            if (a2 == ff_1.da || a2 == ff_1.Ca) {
                return ((Wa)a4.B.M).H;
            }
            if (a2 == ff_1.k || a2 == ff_1.Ka) {
                return ((xa_0)a4.N.M).D;
            }
            if (a2 == ff_1.Ga) {
                return ((ta_0)a4.A.M).c;
            }
            if (a2 == ff_1.h) {
                return ((ta_0)a4.A.M).M;
            }
            if (a2 == ff_1.L) {
                return ((sa_0)a4.d.M).c;
            }
            if (a2 == ff_1.ha) {
                return ((sa_0)a4.d.M).M;
            }
            if (a2 == ff_1.d) {
                return ((pa_0)a4.Z.M).h == df_1.c;
            }
        } else if (a3 == oe_1.c) {
            if (a2 == ff_1.Ga) {
                return true;
            }
            if (a2 == ff_1.h) {
                return true;
            }
        } else if (a3 == oe_1.b) {
            return a4.c;
        }
        return true;
    }

    private /* synthetic */ <T> T j(List<T> a2) {
        return a2.get(0);
    }

    @Override
    public /* synthetic */ void E(long a2, String a3, int a4, int a5, boolean a6) {
        gd_1 a7;
        a7.b = a2;
        a7.f.E(a2, a3, a4, a5);
    }

    private /* synthetic */ <T> T E(List<T> a2) {
        List<T> list = a2;
        return list.get(list.size() - 1);
    }

    private /* synthetic */ void A(long a2) {
        gd_1 a3;
        gd_1 gd_12 = a3;
        double d2 = gd_12.x.E(a2);
        double d3 = gd_12.i.E(a2) - d2;
        gd_12.E(ff_1.Ga, (Double)d3, a2);
        wd_2 wd_22 = gd_12.k.E(a2, d3, a3.a);
        if (wd_22 != null) {
            gd_1 gd_13;
            ff_1 ff_12;
            wd_2 wd_23 = wd_22;
            if (wd_23.D) {
                ff_12 = ff_1.I;
                gd_13 = a3;
            } else {
                ff_12 = ff_1.R;
                gd_13 = a3;
            }
            a3.E(wd_23, ff_12, gd_13.C);
        }
        if ((wd_22 = a3.F.E(a2, d3, a3.a)) != null) {
            gd_1 gd_14;
            ff_1 ff_13;
            wd_2 wd_24 = wd_22;
            if (wd_24.D) {
                ff_13 = ff_1.Ca;
                gd_14 = a3;
            } else {
                ff_13 = ff_1.da;
                gd_14 = a3;
            }
            a3.E(wd_24, ff_13, gd_14.B);
        }
    }

    @Override
    public /* synthetic */ void a() {
        gd_1 a2;
        if (a2.c) {
            return;
        }
        a2.c = true;
        a2.E(oe_1.b, a2.c);
    }

    @Override
    public /* synthetic */ void void_j() {
        gd_1 a2;
        gd_1 gd_12 = a2;
        super.void_j();
        gd_12.U.void_E();
        gd_12.e.void_E();
        gd_12.T.E();
        gd_12.G.j(a2);
        gd_12.Z.j(a2);
        gd_12.E.j(a2);
        gd_12.C.j(a2);
        gd_12.B.j(a2);
        gd_12.A.j(a2);
        gd_12.d.j(a2);
        gd_12.f.void_E();
        gd_12.I.void_E(0L);
        gd_12.h.void_E(0L);
        gd_12.D.E();
        gd_12.n.E();
        gd_12.k.j();
        gd_12.F.j();
        gd_12.l.E();
        gd_12.M.void_a();
        gd_12.J.void_E();
        gd_12.u.void_E();
    }

    private /* synthetic */ void a(lg_0 a2) {
        gd_1 a3;
        if (a3.s.size() == 0) {
            if (a2.C) {
                a3.s.add(a2);
                return;
            }
        } else {
            Iterator<lg_0> iterator;
            gd_1 gd_12 = a3;
            if (gd_12.E(gd_12.s).D == a2.D && a2.C) {
                a3.s.add(a2);
                return;
            }
            int n2 = Integer.MAX_VALUE;
            int n3 = Integer.MIN_VALUE;
            int n4 = 0;
            Iterator<lg_0> iterator2 = iterator = a3.s.iterator();
            while (iterator2.hasNext()) {
                lg_0 lg_02 = iterator.next();
                n2 = Math.min(n2, lg_02.K);
                n3 = Math.max(n3, lg_02.H);
                n4 += lg_02.E;
                iterator2 = iterator;
            }
            double d2 = ((ze_2)((Object)a3.M)).double_E(n4);
            if ((n2 = Math.abs(n3 - n2) + 1) >= ((ra)a3.j.M).M && d2 >= ((ra)a3.j.M).c) {
                lg_0 lg_03;
                ff_1 ff_12;
                gd_1 gd_13 = a3;
                n3 = gd_13.s.size();
                lg_0 lg_04 = gd_13.j(gd_13.s);
                gd_1 gd_14 = a3;
                lg_0 lg_05 = gd_14.E(gd_14.s);
                long l2 = (lg_05.h - lg_04.b) * 1000L / Intervals.INTERVAL_1_SECOND;
                if (lg_05.D) {
                    ff_12 = ff_1.f;
                    lg_03 = lg_05;
                } else {
                    ff_12 = ff_1.Q;
                    lg_03 = lg_05;
                }
                a3.j(ff_12, lg_03.c, if_0.E((ze_2)((Object)a3.M), lg_05.h, lg_05.c, n2, d2, n3, l2, lg_05.D), lg_05.h, a3.b);
                if (a3.w && a3.c && ((ra)a3.j.M).A) {
                    if (((ra)a3.j.M).b.boolean_E()) {
                        gd_1 gd_15 = a3;
                        gd_15.D.E(if_0.E((ze_2)((Object)gd_15.M), ((ra)a3.j.M).b, lg_05.c, d2, lg_05.D));
                    }
                    if (((ra)a3.j.M).C == df_1.c) {
                        gd_1 gd_16 = a3;
                        gd_16.D.j(((ze_2)((Object)gd_16.M)).M, if_0.E((ze_2)((Object)a3.M), lg_05.c, n2, d2, n3, l2, lg_05.D));
                    }
                    if (((ra)a3.j.M).D == df_1.c) {
                        gd_1 gd_17 = a3;
                        if (gd_17.U.E(((ze_2)((Object)gd_17.M)).j)) {
                            gd_1 gd_18;
                            bf_2 bf_22;
                            cf_2 cf_22 = a3.T;
                            if (lg_05.D) {
                                bf_22 = bf_2.b;
                                gd_18 = a3;
                            } else {
                                bf_22 = bf_2.c;
                                gd_18 = a3;
                            }
                            cf_22.E(hg_0.K, bf_22, if_0.E((ze_2)((Object)gd_18.M), lg_05.c, n2, d2, n3, l2, lg_05.D));
                        }
                    }
                }
            }
            a3.s.clear();
            if (a2.C) {
                a3.s.add(a2);
            }
        }
    }

    @Override
    public /* synthetic */ void E(pf_0 a2) {
        block17: {
            boolean bl;
            gd_1 gd_12;
            ff_1 ff_12;
            oe_1 oe_12;
            block9: {
                gd_1 a3;
                block16: {
                    block15: {
                        block14: {
                            block13: {
                                block12: {
                                    block11: {
                                        block10: {
                                            block8: {
                                                if (a2 != pf_0.k) break block8;
                                                gd_1 gd_13 = a3;
                                                gd_13.j(ff_1.v, oe_1.M, ((ua)gd_13.G.M).C);
                                                gd_1 gd_14 = a3;
                                                oe_12 = oe_1.M;
                                                ff_12 = ff_1.ga;
                                                gd_12 = gd_14;
                                                bl = ((ua)gd_14.G.M).C;
                                                break block9;
                                            }
                                            if (a2 != pf_0.K) break block10;
                                            gd_1 gd_15 = a3;
                                            gd_15.j(ff_1.B, oe_1.M, ((pa_0)gd_15.Z.M).M);
                                            gd_1 gd_16 = a3;
                                            oe_12 = oe_1.M;
                                            ff_12 = ff_1.ia;
                                            gd_12 = gd_16;
                                            bl = ((pa_0)gd_16.Z.M).M;
                                            break block9;
                                        }
                                        if (a2 != pf_0.R) break block11;
                                        gd_1 gd_17 = a3;
                                        gd_17.j(ff_1.Q, oe_1.M, ((ra)gd_17.j.M).A);
                                        gd_1 gd_18 = a3;
                                        oe_12 = oe_1.M;
                                        ff_12 = ff_1.f;
                                        gd_12 = gd_18;
                                        bl = ((ra)gd_18.j.M).A;
                                        break block9;
                                    }
                                    if (a2 != pf_0.n) break block12;
                                    gd_1 gd_19 = a3;
                                    gd_19.j(ff_1.i, oe_1.M, ((Ob)gd_19.E.M).M);
                                    gd_1 gd_110 = a3;
                                    oe_12 = oe_1.M;
                                    ff_12 = ff_1.q;
                                    gd_12 = gd_110;
                                    bl = ((Ob)gd_110.E.M).M;
                                    break block9;
                                }
                                if (a2 != pf_0.da) break block13;
                                gd_1 gd_111 = a3;
                                gd_111.j(ff_1.R, oe_1.M, ((Wa)gd_111.C.M).H);
                                gd_1 gd_112 = a3;
                                gd_112.j(ff_1.I, oe_1.M, ((Wa)gd_112.C.M).H);
                                gd_1 gd_113 = a3;
                                gd_113.j(ff_1.da, oe_1.M, ((Wa)gd_113.B.M).H);
                                gd_1 gd_114 = a3;
                                oe_12 = oe_1.M;
                                ff_12 = ff_1.Ca;
                                gd_12 = gd_114;
                                bl = ((Wa)gd_114.B.M).H;
                                break block9;
                            }
                            if (a2 == pf_0.Q) {
                                gd_1 gd_115 = a3;
                                gd_115.k.E();
                                gd_115.F.E();
                                return;
                            }
                            if (a2 != pf_0.N) break block14;
                            gd_1 gd_116 = a3;
                            gd_116.j(ff_1.k, oe_1.M, ((xa_0)gd_116.N.M).D);
                            gd_1 gd_117 = a3;
                            oe_12 = oe_1.M;
                            ff_12 = ff_1.Ka;
                            gd_12 = gd_117;
                            bl = ((xa_0)gd_117.N.M).D;
                            break block9;
                        }
                        if (a2 == pf_0.Ca) {
                            gd_1 gd_118 = a3;
                            gd_118.l.E(((xa_0)gd_118.N.M).M);
                            return;
                        }
                        if (a2 == pf_0.b) {
                            if (!a3.e.boolean_j()) {
                                return;
                            }
                            gd_1 gd_119 = a3;
                            gd_119.K.E(((xa_0)gd_119.N.M).c);
                            gd_1 gd_120 = a3;
                            gd_120.m.E(((xa_0)gd_120.N.M).c);
                            return;
                        }
                        if (a2 != pf_0.h) break block15;
                        gd_1 gd_121 = a3;
                        gd_121.j(ff_1.h, oe_1.M, ((ta_0)gd_121.A.M).M);
                        gd_1 gd_122 = a3;
                        oe_12 = oe_1.M;
                        ff_12 = ff_1.Ga;
                        gd_12 = gd_122;
                        bl = ((ta_0)gd_122.A.M).c;
                        break block9;
                    }
                    if (a2 != pf_0.f) break block16;
                    gd_1 gd_123 = a3;
                    gd_123.j(ff_1.L, oe_1.M, ((sa_0)gd_123.d.M).c);
                    gd_1 gd_124 = a3;
                    oe_12 = oe_1.M;
                    ff_12 = ff_1.ha;
                    gd_12 = gd_124;
                    bl = ((sa_0)gd_124.d.M).M;
                    break block9;
                }
                if (a2 == pf_0.x) {
                    gd_1 gd_125 = a3;
                    gd_125.J.E(((sa_0)gd_125.d.M).C << 1);
                    gd_1 gd_126 = a3;
                    gd_126.u.E(((sa_0)gd_126.d.M).A << 1);
                    return;
                }
                if (a2 != pf_0.ga) break block17;
                gd_1 gd_127 = a3;
                oe_12 = oe_1.M;
                ff_12 = ff_1.d;
                gd_12 = gd_127;
                bl = ((pa_0)gd_127.Z.M).h == df_1.c;
            }
            gd_12.j(ff_12, oe_12, bl);
        }
    }

    private /* synthetic */ void a(long a2) {
        gd_1 a3;
        if (a3.D.E(a2 = (long)((double)a2 - ((Ob)a3.E.M).D * 1.0E9), ((Ob)a3.E.M).H)) {
            gd_1 gd_12 = a3;
            gd_1 gd_13 = a3;
            gd_12.j(ff_1.i, gd_12.D.H, gd_13.D.ttw_tradefinder_cc_0_E((ze_2)((Object)gd_13.M)), a3.D.c, a3.b);
            if (gd_12.w && a3.c && ((Ob)a3.E.M).M) {
                if (((Ob)a3.E.M).A.boolean_E()) {
                    gd_1 gd_14 = a3;
                    gd_1 gd_15 = a3;
                    gd_14.D.E(gd_14.D.E((ze_2)((Object)gd_15.M), ((Ob)gd_15.E.M).A));
                }
                if (((Ob)a3.E.M).C == df_1.c) {
                    gd_1 gd_16 = a3;
                    gd_1 gd_17 = a3;
                    gd_16.D.j(((ze_2)((Object)gd_16.M)).M, gd_17.D.java_lang_String_E((ze_2)((Object)gd_17.M)));
                }
                if (((Ob)a3.E.M).h == df_1.c) {
                    gd_1 gd_18 = a3;
                    if (gd_18.U.E(((ze_2)((Object)gd_18.M)).j)) {
                        gd_1 gd_19 = a3;
                        a3.T.E(hg_0.i, bf_2.c, gd_19.D.E((ze_2)((Object)gd_19.M)));
                    }
                }
            }
            a3.D.E();
        }
        if (a3.n.E(a2, ((Ob)a3.E.M).H)) {
            gd_1 gd_110 = a3;
            gd_1 gd_111 = a3;
            gd_110.j(ff_1.q, gd_110.n.H, gd_111.n.ttw_tradefinder_cc_0_E((ze_2)((Object)gd_111.M)), a3.n.c, a3.b);
            if (gd_110.w && a3.c && ((Ob)a3.E.M).M) {
                if (((Ob)a3.E.M).A.boolean_E()) {
                    gd_1 gd_112 = a3;
                    gd_1 gd_113 = a3;
                    gd_112.D.E(gd_112.n.E((ze_2)((Object)gd_113.M), ((Ob)gd_113.E.M).A));
                }
                if (((Ob)a3.E.M).C == df_1.c) {
                    gd_1 gd_114 = a3;
                    gd_1 gd_115 = a3;
                    gd_114.D.j(((ze_2)((Object)gd_114.M)).M, gd_115.n.java_lang_String_E((ze_2)((Object)gd_115.M)));
                }
                if (((Ob)a3.E.M).h == df_1.c) {
                    gd_1 gd_116 = a3;
                    if (gd_116.U.E(((ze_2)((Object)gd_116.M)).j)) {
                        gd_1 gd_117 = a3;
                        a3.T.E(hg_0.i, bf_2.b, gd_117.n.E((ze_2)((Object)gd_117.M)));
                    }
                }
            }
            a3.n.E();
        }
    }
}

