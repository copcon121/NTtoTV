/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
 *  velox.api.layer1.data.TradeInfo
 */
package ttw.tradefinder;

import java.lang.invoke.CallSite;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.apache.commons.lang3.tuple.Pair;
import ttw.tradefinder.Jd;
import ttw.tradefinder.K;
import ttw.tradefinder.Oa;
import ttw.tradefinder.Pc;
import ttw.tradefinder.bf_2;
import ttw.tradefinder.cd;
import ttw.tradefinder.cd_2;
import ttw.tradefinder.cf_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.ee_0;
import ttw.tradefinder.ef_2;
import ttw.tradefinder.et;
import ttw.tradefinder.f;
import ttw.tradefinder.f_0;
import ttw.tradefinder.fe_1;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.hg_0;
import ttw.tradefinder.ie_0;
import ttw.tradefinder.kc_2;
import ttw.tradefinder.n_0;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.pb_2;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.s_0;
import ttw.tradefinder.va_0;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.x_0;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.y_0;
import ttw.tradefinder.ze_2;
import velox.api.layer1.data.TradeInfo;

/*
 * Renamed from ttw.tradefinder.gB
 */
public class gb_2
extends kc_2
implements y_0,
x_0,
n_0 {
    private int i;
    private int e;
    private final TreeMap<Long, Pair<Double, Double>> k;
    private List<Integer> B;
    private final cf_2 K;
    private int E;
    private boolean j;
    private boolean a;
    private final ee_0 h;
    private final df_0<Oa, et> H;
    private final df_0<va_0, f> D;
    private final ef_2 A;
    private final K C;
    private int M;
    private static int b = 2;
    private final K c;

    @Override
    public /* synthetic */ void E(long a2, int a3, int a4, boolean a52) {
        gb_2 a6;
        gb_2 gb_22 = a6;
        int a52 = (int)gb_22.h.long_j();
        int n2 = gb_22.h.int_j();
        int n3 = gb_22.h.int_E();
        if (!((Oa)gb_22.H.M).j && !((Oa)a6.H.M).a) {
            return;
        }
        if (n2 == ee_0.h || n3 == ee_0.h) {
            return;
        }
        if ((double)a4 < (double)a6.i * 0.9) {
            a6.B.remove((Object)a3);
        }
        if (((Oa)a6.H.M).j) {
            a6.E(a2, n2, n3, a3, a4, a52);
        }
        if (((Oa)a6.H.M).a) {
            a6.j(a2, n2, n3, a3, a4, a52);
        }
    }

    @Override
    public /* synthetic */ void E(long a2, int a32) {
        if (a32 == b) {
            long l2;
            boolean bl;
            Pair<Double, Double> pair;
            gb_2 a4;
            gb_2 gb_22 = a4;
            gb_2 gb_23 = a4;
            a4.k.put(a2, (Pair<Double, Double>)Pair.of((Object)gb_22.M.double_E(a4.M), (Object)gb_23.M.double_E(gb_23.e)));
            gb_2 gb_24 = a4;
            gb_24.M = 0;
            gb_24.e = 0;
            double d2 = gb_22.h.j(((Oa)a4.H.M).H, ((Oa)a4.H.M).D);
            gb_2 gb_25 = a4;
            double d3 = gb_25.h.E(((Oa)gb_25.H.M).H, ((Oa)a4.H.M).D);
            long l3 = (long)((double)a2 - (double)((Oa)a4.H.M).G * 1.0E9);
            gb_2 gb_26 = a4;
            Pair<Double, Double> a32 = gb_26.E(l3);
            gb_26.j(ff_1.o, new pb_2(d2, d3, (Double)a32.getLeft(), (Double)a32.getRight(), a2), a2);
            if (!a4.C.boolean_j()) {
                pair = a32;
                a4.k.headMap(l3).clear();
            } else {
                long l4 = (long)((double)a2 - (double)((Oa)a4.H.M).c * 1.0E9);
                gb_2 gb_27 = a4;
                d2 = gb_27.h.j(((Oa)gb_27.H.M).e, ((Oa)a4.H.M).k);
                gb_2 gb_28 = a4;
                d3 = gb_28.h.E(((Oa)gb_28.H.M).e, ((Oa)a4.H.M).k);
                gb_2 gb_29 = a4;
                a32 = gb_29.E(l4);
                gb_29.k.headMap(Math.min(l4, l3)).clear();
                pair = a32;
            }
            double d4 = (Double)pair.getLeft() / d2 - (Double)a32.getRight() / d3;
            if (Double.isNaN(d4)) {
                return;
            }
            gb_2 gb_210 = a4;
            gb_210.E(ff_1.Ha, (Double)d4, a2);
            int n2 = Math.abs((int)(d4 * 100.0));
            if (d4 < 0.0) {
                bl = true;
                l2 = a2;
            } else {
                bl = false;
                l2 = a2;
            }
            gb_210.j(ff_1.C, n2, bl, l2);
        }
    }

    @Override
    public /* synthetic */ void E(pf_0 a2) {
        gb_2 a3;
        if (a2 == pf_0.j) {
            gb_2 gb_22 = a3;
            gb_22.j(ff_1.G, oe_1.M, ((Oa)gb_22.H.M).j);
            gb_2 gb_23 = a3;
            gb_23.j(ff_1.S, oe_1.M, ((Oa)gb_23.H.M).j);
            gb_2 gb_24 = a3;
            gb_24.j(ff_1.N, oe_1.M, ((Oa)gb_24.H.M).j);
            gb_2 gb_25 = a3;
            gb_25.j(ff_1.M, oe_1.M, ((Oa)gb_25.H.M).j);
            return;
        }
        if (a2 == pf_0.o) {
            gb_2 gb_26 = a3;
            gb_26.j(ff_1.n, oe_1.M, ((Oa)gb_26.H.M).a);
            gb_2 gb_27 = a3;
            gb_27.j(ff_1.D, oe_1.M, ((Oa)gb_27.H.M).a);
            return;
        }
        if (a2 == pf_0.O) {
            gb_2 gb_28 = a3;
            gb_28.j(ff_1.C, oe_1.M, ((Oa)gb_28.H.M).h);
            return;
        }
        if (a2 == pf_0.X || a2 == pf_0.F) {
            a3.E = (int)(((Oa)a3.H.M).J * a3.M.A);
            a3.i = (int)(((Oa)a3.H.M).K * a3.M.A);
            return;
        }
        if (a2 == pf_0.h) {
            gb_2 gb_29 = a3;
            gb_29.j(ff_1.Ha, oe_1.M, ((va_0)gb_29.D.M).c);
        }
    }

    public /* synthetic */ gb_2(String a2, f_0 a3, ze_2 a4, xf_2 a5, s_0 a6) {
        gb_2 a7;
        gb_2 gb_22 = a7;
        gb_2 gb_23 = a7;
        gb_2 gb_24 = a7;
        gb_2 gb_25 = a7;
        gb_2 gb_26 = a7;
        super(a3, a4, a6);
        gb_26.j = false;
        gb_26.a = false;
        gb_25.B = new ArrayList<Integer>();
        gb_25.k = new TreeMap();
        gb_25.M = 0;
        gb_24.e = 0;
        gb_24.E = 0;
        gb_23.i = 0;
        gb_23.A = new ef_2(wa_2.java_lang_String_E("h]"));
        gb_23.h = a5.ttw_tradefinder_ee_0_E();
        a7.K = a7.ttw_tradefinder_cf_2_E();
        a7.H = a3.E((String)a2, a4.M, new Oa(a4.A));
        gb_22.H.E(a7);
        gb_22.D = a3.E((String)a2, a4.M, new va_0());
        gb_2 gb_27 = a7;
        gb_22.D.E(gb_27);
        gb_27.E = (int)(((Oa)gb_27.H.M).J * a7.M.A);
        a7.i = (int)(((Oa)a7.H.M).K * a7.M.A);
        a2 = new Pc(ie_0.E("77\r-\f=\"0\u00006\u0006=,=\u0012+\u00046\u0006=\u0013"), Arrays.asList(cd.A, cd.C, cd.c, cd.D), a3.ttw_tradefinder_qc_1_E());
        gb_2 gb_28 = a7;
        gb_28.c = a2.E(null);
        a2 = new Pc(wa_2.java_lang_String_E("TYkS|LXT|JmK]]o"), Collections.emptyList(), a3.ttw_tradefinder_qc_1_E());
        gb_28.C = a2.E(null);
        gb_28.j = a3.boolean_j();
        gb_28.a = false;
        gb_28.a(ff_1.G);
        gb_28.a(ff_1.S);
        gb_28.a(ff_1.N);
        gb_28.a(ff_1.M);
        gb_28.a(ff_1.n);
        gb_28.a(ff_1.D);
        gb_28.a(ff_1.o);
        gb_28.a(ff_1.Ha);
        gb_28.a(ff_1.C);
        gb_28.void_E();
        gb_28.E(new cd_2(cd_2.a, a7, b));
    }

    @Override
    public /* synthetic */ void void_j() {
        gb_2 a2;
        gb_2 gb_22 = a2;
        super.void_j();
        gb_22.c.void_E();
        gb_22.C.void_E();
        gb_22.K.E();
        gb_22.H.j(a2);
        gb_22.D.j(a2);
        gb_22.k.clear();
        gb_22.A.j();
    }

    private /* synthetic */ Pair<Double, Double> E(long a2) {
        gb_2 a3;
        double d2 = 0.0;
        double d3 = 0.0;
        Iterator<Pair<Double, Double>> iterator = a2 = a3.k.tailMap(a2).values().iterator();
        while (iterator.hasNext()) {
            Pair<Double, Double> pair = a2.next();
            d2 += ((Double)pair.getLeft()).doubleValue();
            d3 += ((Double)pair.getRight()).doubleValue();
            iterator = a2;
        }
        return Pair.of((Object)d2, (Object)d3);
    }

    private /* synthetic */ void j(long a22, int a3, int a4, int a5, int a6, int a72) {
        gb_2 a8;
        if ((a5 >= a3 + ((Oa)a8.H.M).C && a5 <= a3 + ((Oa)a8.H.M).M || a5 <= a4 - ((Oa)a8.H.M).C && a5 >= a4 - ((Oa)a8.H.M).M) && !a8.B.contains(a5) && a6 >= a8.i) {
            int n2;
            ff_1 ff_12;
            a8.B.add(a5);
            if (a72 >= a8.i) {
                return;
            }
            gb_2 gb_22 = a8;
            String a72 = gb_22.M.java_lang_String_E(a6);
            String string = gb_22.M.java_lang_String_j(a5);
            if (a5 >= a3) {
                ff_12 = ff_1.n;
                n2 = a5;
            } else {
                ff_12 = ff_1.D;
                n2 = a5;
            }
            gb_22.j(ff_12, n2, new Jd(string, a72, (float)a6 / (float)a8.i), a22);
            if (a8.j && a8.a && ((Oa)a8.H.M).a) {
                Object a22 = a5 == a3 || a5 == a4 ? wa_2.java_lang_String_E("YzLlYu\u0018iJp[|") : ie_0.E("\u00057\fx\r=\u0017=\r");
                String string2 = a5 >= a3 ? wa_2.java_lang_String_E("XKr") : ie_0.E("#1\u0005");
                a22 = String.format(wa_2.java_lang_String_E("\u001dj\u0018<K9[vVmJx[mK9J|YzP|\\9Ym\u0018<K9\u001dj"), a72, string2, a22, string);
                if (((Oa)a8.H.M).d.boolean_E()) {
                    gb_2 gb_23 = a8;
                    gb_23.D.E(((Oa)gb_23.H.M).d.E(a8.M.D, string2 + " Liquidity reached", a72, string, a5 <= a4));
                }
                if (((Oa)a8.H.M).F == df_1.c) {
                    gb_2 gb_24 = a8;
                    gb_24.D.j(gb_24.M.M, (String)a22);
                }
                if (((Oa)a8.H.M).E == df_1.c) {
                    gb_2 gb_25 = a8;
                    if (gb_25.c.E(gb_25.M.j)) {
                        Object object;
                        bf_2 bf_22;
                        a22 = new HashMap<String, CallSite>();
                        a22.put(ie_0.E("\u0014\b)\u00141\u00051\u0015!Ap\u0000:\u0012vH"), ee.E(fe_1.l) + " " + a8.M.java_lang_String_E(a6));
                        a22.put(wa_2.java_lang_String_E("IJp[|"), string);
                        cf_2 cf_22 = a8.K;
                        if (a5 >= a3) {
                            bf_22 = bf_2.c;
                            object = a22;
                        } else {
                            bf_22 = bf_2.b;
                            object = a22;
                        }
                        cf_22.E(hg_0.d, bf_22, (Map<String, String>)object);
                    }
                }
            }
        }
    }

    @Override
    public /* synthetic */ void E(long a2, int a3, int a4, TradeInfo a5) {
        if (a5.isBidAggressor) {
            a.M += a4;
            return;
        }
        a.e += a4;
    }

    private /* synthetic */ void E(long a22, int a3, int a4, int a5, int a6, int a72) {
        int n2;
        gb_2 a8;
        if ((a5 >= a3 + ((Oa)a8.H.M).b && a5 <= a3 + ((Oa)a8.H.M).i || a5 <= a4 - ((Oa)a8.H.M).b && a5 >= a4 - ((Oa)a8.H.M).i) && (n2 = Math.abs(a72 - a6)) >= a8.E) {
            String string;
            String string2;
            String string3 = a8.M.java_lang_String_E(n2);
            if (a6 < a72) {
                string2 = ie_0.E("L");
                string = string3;
            } else {
                string2 = wa_2.java_lang_String_E("2");
                string = string3;
            }
            String string4 = string2 + string;
            String string5 = a8.M.java_lang_String_j(a5);
            a6 = a72 < a6 ? 1 : 0;
            gb_2 gb_22 = a8;
            gb_22.j(gb_22.E(a6 != 0, a5 >= a3), a5, new Jd(string5, string4, (float)n2 / (float)a8.E), a22);
            if (a8.j && a8.a && ((Oa)a8.H.M).j) {
                Object a22 = a6 != 0 ? ie_0.E(" <\u0005=\u0005") : wa_2.java_lang_String_E("K]tWo]}");
                String string6 = a5 == a3 || a5 == a4 ? ie_0.E("9\u0002,\u00149\rx\u0011*\b;\u0004") : wa_2.java_lang_String_E("}Wt\u0018u]o]u");
                String a72 = a5 >= a3 ? ie_0.E(" +\n") : wa_2.java_lang_String_E("[Q}");
                a22 = String.format(ie_0.E("D+A}\u0012xD+A;\u000e6\u0015*\u0000;\u0015+A9\u0015xD+A}\u0012"), a22, string3, a72, string6, string5);
                if (((Oa)a8.H.M).B.boolean_E()) {
                    gb_2 gb_23 = a8;
                    gb_23.D.E(((Oa)gb_23.H.M).B.E(a8.M.D, a72 + " Liquidity " + (a6 != 0 ? wa_2.java_lang_String_E("x\\}]}") : ie_0.E("\u0013=\f7\u0017=\u0005")), string3, string5, a5 <= a4));
                }
                if (((Oa)a8.H.M).f == df_1.c) {
                    gb_2 gb_24 = a8;
                    gb_24.D.j(gb_24.M.M, (String)a22);
                }
                if (((Oa)a8.H.M).A == df_1.c) {
                    gb_2 gb_25 = a8;
                    if (gb_25.c.E(gb_25.M.j)) {
                        Object object;
                        bf_2 bf_22;
                        int n3;
                        hg_0 hg_02;
                        a22 = new HashMap<String, CallSite>();
                        a22.put(wa_2.java_lang_String_E("tpIlQ}QmA9\u0010k]u\u00160"), string4);
                        a22.put(ie_0.E("1*\b;\u0004"), string5);
                        cf_2 cf_22 = a8.K;
                        if (a6 != 0) {
                            hg_02 = hg_0.h;
                            n3 = a5;
                        } else {
                            hg_02 = hg_0.c;
                            n3 = a5;
                        }
                        if (n3 >= a3) {
                            bf_22 = bf_2.c;
                            object = a22;
                        } else {
                            bf_22 = bf_2.b;
                            object = a22;
                        }
                        cf_22.E(hg_02, bf_22, (Map<String, String>)object);
                    }
                }
            }
        }
    }

    @Override
    public /* synthetic */ void d(long a2) {
        gb_2 a3;
        a3.l(a2);
    }

    @Override
    public /* synthetic */ void a() {
        gb_2 a2;
        if (a2.a) {
            return;
        }
        a2.a = true;
        a2.E(oe_1.b, a2.a);
    }

    @Override
    public /* synthetic */ boolean E(ff_1 a2, oe_1 a3) {
        gb_2 a4;
        if (a3 == oe_1.M) {
            if (a2 == ff_1.G || a2 == ff_1.S) {
                return ((Oa)a4.H.M).j;
            }
            if (a2 == ff_1.N || a2 == ff_1.M) {
                return ((Oa)a4.H.M).j;
            }
            if (a2 == ff_1.n || a2 == ff_1.D) {
                return ((Oa)a4.H.M).a;
            }
            if (a2 == ff_1.C) {
                return ((Oa)a4.H.M).h;
            }
            if (a2 == ff_1.Ha) {
                return ((va_0)a4.D.M).c;
            }
        } else if (a3 == oe_1.b) {
            return a4.a;
        }
        return true;
    }

    @Override
    public /* synthetic */ void void_E() {
        gb_2 a2;
        super.void_E();
        a2.a = false;
    }

    private /* synthetic */ ff_1 E(boolean a2, boolean a3) {
        if (a3) {
            if (a2) {
                return ff_1.G;
            }
            return ff_1.S;
        }
        if (a2) {
            return ff_1.N;
        }
        return ff_1.M;
    }
}

