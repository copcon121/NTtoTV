/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.TradeInfo
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import ttw.tradefinder.K;
import ttw.tradefinder.Pc;
import ttw.tradefinder.ae_2;
import ttw.tradefinder.af_0;
import ttw.tradefinder.bf_2;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.cd_2;
import ttw.tradefinder.cf_2;
import ttw.tradefinder.d;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.dg_0;
import ttw.tradefinder.eb_0;
import ttw.tradefinder.ec_0;
import ttw.tradefinder.ee_0;
import ttw.tradefinder.el;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.hg_0;
import ttw.tradefinder.ie_0;
import ttw.tradefinder.in;
import ttw.tradefinder.jf_0;
import ttw.tradefinder.jf_1;
import ttw.tradefinder.kc_2;
import ttw.tradefinder.lD;
import ttw.tradefinder.n_0;
import ttw.tradefinder.nb_2;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.pa_1;
import ttw.tradefinder.pe_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.qd_2;
import ttw.tradefinder.qe_2;
import ttw.tradefinder.ra_0;
import ttw.tradefinder.s_0;
import ttw.tradefinder.se_0;
import ttw.tradefinder.t_0;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.xB;
import ttw.tradefinder.x_0;
import ttw.tradefinder.xf_0;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.y_0;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;
import velox.api.layer1.data.TradeInfo;

/*
 * Renamed from ttw.tradefinder.Jb
 */
public class jb_2
extends kc_2
implements y_0,
x_0,
n_0,
t_0 {
    private final ie_0 f;
    private boolean F;
    private final df_0<ra_0, d> J;
    private final df_0<za_0, el> G;
    private final xf_0 d;
    private final se_0 i;
    private final List<String> e;
    private final xf_0 k;
    private static final int B = 10;
    private final se_0 K;
    private final pe_1 E;
    private boolean j;
    private boolean a;
    private final Object h;
    private final K H;
    private final pe_1 D;
    private final ee_0 A;
    private final K C;
    private final K M;
    private final df_0<ua_0, in> b;
    private final cf_2 c;

    private /* synthetic */ Map<String, String> E(double a2, jf_1 a3) {
        jb_2 a4;
        HashMap<String, String> hashMap = new HashMap<String, String>();
        hashMap.put(lD.E("X\u001db\u0007c\u0017"), ((ze_2)((Object)a4.M)).E(a2));
        if (a3.B != 0) {
            double d2 = ((ze_2)((Object)a4.M)).E(a3.B);
            hashMap.put(qe_2.E("Ni{cyo/\\`fzgj"), ((ze_2)((Object)a4.M)).E(d2));
            hashMap.put(lD.E("^\u0013}\u0001g\u0004kRX\u001db\u0007c\u0017"), ((ze_2)((Object)a4.M)).E(a2 - d2));
        }
        hashMap.put(qe_2.E("_xfij"), ((ze_2)((Object)a4.M)).j(a3.A));
        if (a4.M.j() && a3.j != 0) {
            hashMap.put(lD.E("Z\u0000o\u001cm\u001akR]\u001bt\u0017"), ((ze_2)((Object)a4.M)).E(a3.j));
        }
        return hashMap;
    }

    private /* synthetic */ cc_0 E(double a2, jf_1 a3) {
        jb_2 jb_22;
        double d2;
        jb_2 a4;
        Object object = a3.M != false ? lD.E("F\u001bj\u0016k\u001c.0g\u0016") : qe_2.E("Bfnkoa*Nyd");
        object = (String)object + (a3.M == dg_0.M ? lD.E("#\u001c") : qe_2.E("'|"));
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        if (a4.F && a3.M == dg_0.M) {
            arrayList.add(new eb_0(lD.E("AH"), new ec_0(((ze_2)((Object)a4.M)).E(a3.h))));
            arrayList.add(new eb_0(qe_2.E("N5"), new pa_1(a3.j() / 1000.0)));
            if (a3.B != 0) {
                double d3 = ((ze_2)((Object)a4.M)).E(a3.B);
                double d4 = a2 - d3;
                arrayList.add(new eb_0(lD.E("OH"), new ec_0(((ze_2)((Object)a4.M)).E(d3))));
                arrayList.add(new eb_0(qe_2.E("Z5"), new ec_0(((ze_2)((Object)a4.M)).E(d4))));
            }
        }
        if (a4.M.j() && ((za_0)a4.G.M).E == df_1.c && a3.M == dg_0.M) {
            arrayList.add(new eb_0(lD.E(";JH"), new ec_0((String)a3.D)));
            if (a3.j != 0) {
                arrayList.add(new eb_0(qe_2.E("[Y5"), new ec_0(((ze_2)((Object)a4.M)).E(a3.j))));
            }
        }
        String string = ((ze_2)((Object)a4.M)).j(a3.A);
        if (a3.M != false) {
            d2 = a2;
            jb_22 = a4;
        } else {
            d2 = -a2;
            jb_22 = a4;
        }
        return new cc_0((String)object, string, af_0.h, new xB(d2, ((ze_2)((Object)jb_22.M)).E(a2)), arrayList, null);
    }

    private /* synthetic */ void d() {
        Object object;
        jb_2 a2;
        if (!a2.F) {
            a2.j(ff_1.g);
            return;
        }
        if (!a2.a || !a2.j) {
            return;
        }
        jb_2 jb_22 = a2;
        jb_22.j(ff_1.g);
        jb_2 jb_23 = a2;
        List<jf_1> list = jb_22.f.E(((ua_0)a2.b.M).E((ze_2)((Object)jb_23.M), ((za_0)jb_23.G.M).a));
        Iterator<jf_1> iterator = a2.h;
        synchronized (iterator) {
            a2.e.clear();
            Object object2 = object = list.iterator();
            while (object2.hasNext()) {
                jf_1 jf_12 = object.next();
                object2 = object;
                a2.e.add((String)jf_12.D);
            }
        }
        Iterator<jf_1> iterator2 = iterator = list.iterator();
        while (iterator2.hasNext()) {
            object = iterator.next();
            iterator2 = iterator;
            a2.j(ff_1.g, (jf_1)object);
        }
        a2.j(ff_1.s);
    }

    @Override
    public /* synthetic */ void E(long a2, String a3) {
        jb_2 a4;
        jb_2 jb_22 = a4;
        jb_22.f.E(a2, a3);
        if (!jb_22.F) {
            return;
        }
        jb_2 jb_23 = a4;
        jb_23.i.E(a2, a3);
        jb_23.K.E(a2, a3);
    }

    private /* synthetic */ String j(double a2, jf_1 a3) {
        jb_2 a4;
        Object object = a3.M != false ? lD.E("F;J6K<.0G6") : qe_2.E("BFNKOA*NYD");
        object = (String)object + (a3.M == dg_0.M ? lD.E("#<") : qe_2.E("'\\"));
        String string = a3.B == 0 ? "" : " (" + ((ze_2)((Object)a4.M)).E(a3.a) + ")";
        return String.format(lD.E("W}^.$4R+\u0001.\u0013zR+\u0001"), object, ((ze_2)((Object)a4.M)).E(a2) + string, ((ze_2)((Object)a4.M)).j(a3.A));
    }

    @Override
    public /* synthetic */ void H(long a2) {
        jb_2 a3;
        jb_2 jb_22 = a3;
        double d2 = jb_22.d.E(a2);
        double d3 = jb_22.k.E(a2);
        jb_22.E(ff_1.P, (Double)d2, a2);
        jb_22.E(ff_1.u, (Double)(-d3), a2);
    }

    @Override
    public /* synthetic */ void E(long a2, int a3, int a4, TradeInfo a5) {
        jb_2 a6;
        a6.f.E(a2, a3, a4, a5);
        if (a4 <= 0) {
            return;
        }
        if (!a6.F) {
            return;
        }
        if (a5.isBidAggressor) {
            jb_2 jb_22 = a6;
            jb_22.D.E(a2, a3, a4);
            jb_22.i.E(a2, a3, a4, a5.passiveOrderId);
            return;
        }
        jb_2 jb_23 = a6;
        jb_23.E.E(a2, a3, a4);
        jb_23.K.E(a2, a3, a4, a5.passiveOrderId);
    }

    private /* synthetic */ boolean E(ae_2 a2, dg_0 a3) {
        if (a2 == ae_2.c && a3 != dg_0.M) {
            return false;
        }
        if (a2 == ae_2.M && a3 != dg_0.b) {
            return false;
        }
        return a2 != ae_2.C || a3 != dg_0.b;
    }

    public /* synthetic */ jb_2(String a22, f_0 a3, ze_2 a4, xf_2 a5, s_0 a6) {
        jb_2 a7;
        jb_2 jb_22 = a7;
        jb_2 jb_23 = a7;
        jb_2 jb_24 = a7;
        super(a3, a4, a6);
        a7.d = new xf_0();
        a7.k = new xf_0();
        a7.h = new Object();
        a7.e = new ArrayList<String>();
        jb_24.a = false;
        jb_24.j = false;
        jb_23.F = false;
        jb_23.A = ((xf_2)a5).E();
        a7.c = a7.E();
        a7.G = a3.E((String)a22, a4.M, new za_0(a4.A));
        a7.G.E(a7);
        a7.b = a3.E((String)a22, a4.M, new ua_0());
        jb_22.b.E(a7);
        jb_22.J = a3.E((String)a22, a4.M, new ra_0());
        jb_22.J.E(a7);
        a5 = new Pc(qe_2.E("BfnkoaE}njxBo|yjdho}"), Arrays.asList(cd.A, cd.C, cd.c, cd.D), a3.E());
        a7.H = a5.E(null);
        a5 = new Pc(lD.E("F\u001bj\u0016k\u001cA\u0000j\u0017|6k\u0004"), Arrays.asList(cd.C, cd.c, cd.D), a3.E());
        jb_2 jb_25 = a7;
        jb_25.C = a5.E(new nb_2(a7, a4, a3, (String)a22));
        a22 = new Pc(qe_2.E("BfnkoaE}njxKoy"), Collections.emptyList(), a3.E());
        jb_25.M = a22.E(null);
        jb_25.a = a3.j();
        jb_25.j = false;
        jb_25.a(ff_1.s);
        jb_25.a(ff_1.Ba);
        jb_25.a(ff_1.P);
        jb_25.a(ff_1.u);
        jb_25.a(ff_1.U);
        jb_25.a(ff_1.t);
        jb_25.a(ff_1.m);
        jb_25.a(ff_1.g);
        jb_25.a(ff_1.e);
        jb_25.d.E(10);
        jb_25.k.E(10);
        int a22 = (int)(((za_0)jb_25.G.M).h * a4.A);
        jb_2 jb_26 = a7;
        a7.f = new ie_0(a7);
        jb_26.i = new se_0(a22, false, a7);
        jb_26.K = new se_0(a22, true, a7);
        jb_26.D = new pe_1(a7.A, a22, false, a7);
        jb_26.E = new pe_1(a7.A, a22, true, a7);
        jb_26.E();
        jb_26.E(new cd_2(cd_2.h, a7));
    }

    private /* synthetic */ qd_2 j(double a2, jf_1 a3) {
        jb_2 a4;
        return ((za_0)a4.G.M).D.E(((ze_2)((Object)a4.M)).D, "Hidden " + (a3.M != false ? lD.E("0g\u0016") : qe_2.E("Nyd")), ((ze_2)((Object)a4.M)).E(a2), ((ze_2)((Object)a4.M)).j(a3.A), (boolean)a3.M);
    }

    @Override
    public /* synthetic */ void E(long a2, String a3, int a4, int a5, boolean a6) {
        jb_2 a7;
        jb_2 jb_22 = a7;
        jb_22.f.E(a2, a3, a4, a5, a6);
        if (!jb_22.F) {
            return;
        }
        jb_2 jb_23 = a7;
        jb_23.i.E(a2, a3, a4, a5, a6);
        jb_23.K.E(a2, a3, a4, a5, a6);
    }

    @Override
    public /* synthetic */ void E(jf_1 a2) {
        jb_2 a3;
        if (!a3.a || !a3.j) {
            return;
        }
        jb_2 jb_22 = a3;
        if (!jb_22.E(((za_0)jb_22.G.M).C, a2.M) || a2.M != dg_0.M) {
            return;
        }
        if (!a3.F) {
            return;
        }
        jb_2 jb_23 = a3;
        if (a2.a < ((ua_0)a3.b.M).E((ze_2)((Object)jb_23.M), ((za_0)jb_23.G.M).a)) {
            return;
        }
        a3.j(ff_1.g, a2);
    }

    @Override
    public /* synthetic */ void E(pf_0 a222) {
        pf_0 a222;
        jb_2 a3;
        if (a222 == pf_0.u) {
            jb_2 jb_22 = a3;
            jb_22.j(ff_1.t, oe_1.M, ((za_0)jb_22.G.M).M);
            jb_2 jb_23 = a3;
            jb_23.j(ff_1.m, oe_1.M, ((za_0)jb_23.G.M).M);
            return;
        }
        if (a222 == pf_0.a) {
            jb_2 jb_24 = a3;
            jb_24.j(ff_1.U, oe_1.M, ((za_0)jb_24.G.M).j);
            return;
        }
        if (a222 == pf_0.A) {
            int a222 = (int)(((za_0)a3.G.M).h * ((ze_2)((Object)a3.M)).A);
            jb_2 jb_25 = a3;
            jb_25.i.E(a222);
            jb_25.K.E(a222);
            jb_25.D.E(a222);
            jb_25.E.E(a222);
            return;
        }
        if (a222 == pf_0.m || a222 == pf_0.P) {
            a3.d();
            return;
        }
        if (a222 == pf_0.h) {
            jb_2 jb_26 = a3;
            jb_26.j(ff_1.P, oe_1.M, ((ra_0)jb_26.J.M).c);
            jb_2 jb_27 = a3;
            jb_27.j(ff_1.u, oe_1.M, ((ra_0)jb_27.J.M).c);
        }
    }

    @Override
    public /* synthetic */ boolean E(ff_1 a2, oe_1 a3) {
        jb_2 a4;
        if (a3 == oe_1.M) {
            if (a2 == ff_1.t || a2 == ff_1.m) {
                return ((za_0)a4.G.M).M;
            }
            if (a2 == ff_1.U) {
                return ((za_0)a4.G.M).j;
            }
            if (a2 == ff_1.P || a2 == ff_1.u) {
                return ((ra_0)a4.J.M).c;
            }
        } else if (a3 == oe_1.c) {
            if (a2 == ff_1.P || a2 == ff_1.u) {
                return true;
            }
        } else if (a3 == oe_1.b) {
            return a4.j;
        }
        return true;
    }

    @Override
    public /* synthetic */ void E() {
        jb_2 a2;
        jb_2 jb_22 = a2;
        jb_2 jb_23 = a2;
        super.E();
        jb_23.f.E();
        jb_22.d.E(10);
        jb_22.k.E(10);
        jb_22.j = false;
    }

    @Override
    public /* synthetic */ void a() {
        jb_2 a2;
        if (a2.j) {
            return;
        }
        jb_2 jb_22 = a2;
        jb_22.j = true;
        jb_22.d();
        jb_22.E(oe_1.b, a2.j);
    }

    @Override
    public /* synthetic */ void j(jf_1 a2) {
        jb_2 a3;
        jb_2 jb_22 = a3;
        if (jb_22.E(((za_0)jb_22.G.M).A, a2.M)) {
            jf_1 jf_12 = a2;
            a3.j(ff_1.U, jf_12.a, (boolean)jf_12.M, a2.E);
        }
        jb_2 jb_23 = a3;
        if (jb_23.E(((za_0)jb_23.G.M).C, a2.M)) {
            double d2;
            jb_2 jb_24;
            if (a3.F && a2.M == dg_0.M && a3.a && a3.j) {
                jb_2 jb_25 = a3;
                jb_25.j(ff_1.e, a2);
                Object object = jb_25.h;
                synchronized (object) {
                    a3.e.remove((Object)a2.D);
                    // MONITOREXIT @DISABLED, blocks:[16, 0, 1, 15] lbl15 : MonitorExitStatement: MONITOREXIT : var2_2
                    jb_24 = a3;
                }
            } else {
                jb_24 = a3;
            }
            double d3 = ((ze_2)((Object)jb_24.M)).E(a2.E());
            if (d2 >= ((za_0)a3.G.M).a) {
                jf_1 jf_13;
                ff_1 ff_12;
                if (a2.M != false) {
                    ff_12 = ff_1.m;
                    jf_13 = a2;
                } else {
                    ff_12 = ff_1.t;
                    jf_13 = a2;
                }
                a3.j(ff_12, jf_13.A, a3.E(d3, a2), a2.E, (long)a2.b);
                if (a3.F && a2.M == dg_0.M) {
                    a3.j(ff_1.s, a2);
                }
                if (a3.a && a3.j && ((za_0)a3.G.M).M) {
                    if (((za_0)a3.G.M).D.E()) {
                        a3.D.E(a3.j(d3, a2));
                    }
                    if (((za_0)a3.G.M).H == df_1.c) {
                        jb_2 jb_26 = a3;
                        jb_26.D.j(((ze_2)((Object)jb_26.M)).M, a3.j(d3, a2));
                    }
                    if (((za_0)a3.G.M).c == df_1.c) {
                        jb_2 jb_27 = a3;
                        if (jb_27.H.E(((ze_2)((Object)jb_27.M)).j)) {
                            jb_2 jb_28;
                            bf_2 bf_22;
                            cf_2 cf_22 = a3.c;
                            if (a2.M != false) {
                                bf_22 = bf_2.b;
                                jb_28 = a3;
                            } else {
                                bf_22 = bf_2.c;
                                jb_28 = a3;
                            }
                            cf_22.E(hg_0.e, bf_22, jb_28.E(d3, a2));
                        }
                    }
                }
            }
        }
    }

    @Override
    public /* synthetic */ void j() {
        jb_2 a2;
        jb_2 jb_22 = a2;
        super.j();
        jb_22.C.E();
        jb_22.H.E();
        jb_22.M.E();
        jb_22.c.E();
        jb_22.G.j(a2);
        jb_22.b.j(a2);
        jb_22.J.j(a2);
    }

    @Override
    public /* synthetic */ void E(jf_0 a2, jf_1 a3) {
        jb_2 jb_22;
        jb_2 a4;
        jb_2 jb_23 = a4;
        if (!jb_23.E(((za_0)jb_23.G.M).C, a2.c)) {
            return;
        }
        double d2 = ((ze_2)((Object)a4.M)).E(a2.M);
        jb_2 jb_24 = a4;
        if (a2.b) {
            jb_24.k.E(a2.A, d2);
            jb_22 = a4;
        } else {
            jb_24.d.E(a2.A, d2);
            jb_22 = a4;
        }
        if (jb_22.F) {
            a4.j(ff_1.Ba, a2);
            if (a3 != null && a3.M == dg_0.M && a4.a && a4.j) {
                jb_2 jb_25 = a4;
                if (a3.a >= ((ua_0)a4.b.M).E((ze_2)((Object)jb_25.M), ((za_0)jb_25.G.M).a)) {
                    jb_2 jb_26 = a4;
                    jb_26.j(ff_1.g, a3);
                    boolean bl = false;
                    Object object = jb_26.h;
                    synchronized (object) {
                        if (!a4.e.contains(a3.D)) {
                            a4.e.add((String)a3.D);
                            bl = true;
                        }
                    }
                    if (bl && ((ua_0)a4.b.M).j) {
                        jb_2 jb_27 = a4;
                        double d3 = ((ze_2)((Object)jb_27.M)).E(a3.E());
                        if (((ua_0)jb_27.b.M).C.E()) {
                            a4.D.E(a4.E(d3, a3));
                        }
                        if (((ua_0)a4.b.M).A == df_1.c) {
                            jb_2 jb_28 = a4;
                            jb_28.D.j(((ze_2)((Object)jb_28.M)).M, a4.E(d3, a3));
                        }
                        if (((ua_0)a4.b.M).h == df_1.c) {
                            jb_2 jb_29 = a4;
                            if (jb_29.H.E(((ze_2)((Object)jb_29.M)).j)) {
                                jb_2 jb_210;
                                bf_2 bf_22;
                                cf_2 cf_22 = a4.c;
                                if (a2.b) {
                                    bf_22 = bf_2.b;
                                    jb_210 = a4;
                                } else {
                                    bf_22 = bf_2.c;
                                    jb_210 = a4;
                                }
                                cf_22.E(hg_0.B, bf_22, jb_210.E(d3, a3));
                            }
                        }
                    }
                }
            }
        }
    }

    @Override
    public /* synthetic */ void E(long a2, String a3, int a4, int a5) {
        jb_2 a6;
        jb_2 jb_22 = a6;
        jb_22.f.E(a2, a3, a4, a5);
        if (!jb_22.F) {
            return;
        }
        jb_2 jb_23 = a6;
        jb_23.i.E(a2, a3, a4, a5);
        jb_23.K.E(a2, a3, a4, a5);
    }

    private /* synthetic */ String E(double a22, jf_1 a3) {
        jb_2 a4;
        String a22 = a3.M != false ? qe_2.E("BFNKOA*MCK*KOYOCE_GJD[") : lD.E("F;J6K<.3]9.6K$K>A\"C7@&");
        return String.format(qe_2.E("*y#*Y0//|*n~//|"), a22, ((ze_2)((Object)a4.M)).E(a3.E()), ((ze_2)((Object)a4.M)).j(a3.A));
    }

    private /* synthetic */ qd_2 E(double a2, jf_1 a3) {
        jb_2 a4;
        return ((ua_0)a4.b.M).C.E(((ze_2)((Object)a4.M)).D, "Hidden " + (a3.M != false ? lD.E("0g\u0016") : qe_2.E("Nyd*Koyoce\u007fgjd{")), "", ((ze_2)((Object)a4.M)).j(a3.A), (boolean)a3.M);
    }

    @Override
    public /* synthetic */ void d(long a2) {
        jb_2 a3;
        a3.l(a2);
    }
}

