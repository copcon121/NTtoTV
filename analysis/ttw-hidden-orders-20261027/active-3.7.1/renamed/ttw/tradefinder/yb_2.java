/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import ttw.tradefinder.Jd;
import ttw.tradefinder.K;
import ttw.tradefinder.Pc;
import ttw.tradefinder.Zc;
import ttw.tradefinder.ae_1;
import ttw.tradefinder.bf_2;
import ttw.tradefinder.cd;
import ttw.tradefinder.cd_2;
import ttw.tradefinder.cf_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.e;
import ttw.tradefinder.eM;
import ttw.tradefinder.ee_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.go;
import ttw.tradefinder.hg_0;
import ttw.tradefinder.kc_2;
import ttw.tradefinder.n_0;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.s_0;
import ttw.tradefinder.se_0;
import ttw.tradefinder.sf_0;
import ttw.tradefinder.wd_2;
import ttw.tradefinder.x_0;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.y_0;
import ttw.tradefinder.ya_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Yb
 */
public class yb_2
extends kc_2
implements y_0,
x_0,
n_0 {
    private final df_0<Zc, eM> B;
    private final ae_1 K;
    private final double E = 5.0;
    private final cf_2 j;
    private final df_0<ya_0, e> a;
    private double h;
    private boolean H;
    private final ee_0 D;
    private boolean A;
    private double C;
    private final K M;
    private final K b;
    private double c;

    private /* synthetic */ void j(long a2, int a32, int a42, double a52, double a6) {
        wd_2 wd_22;
        ff_1 ff_12;
        yb_2 a7;
        double d2 = a52;
        wd_2 a32 = a7.K.E(a2, d2, d2 >= 0.0 ? a32 : a42);
        if (a32 == null) {
            return;
        }
        String a42 = Long.toString(Math.round(Math.abs(a32.A)));
        yb_2 yb_22 = a7;
        String a52 = ((ze_2)((Object)yb_22.M)).java_lang_String_j(a32.b);
        if (a32.D) {
            ff_12 = ff_1.r;
            wd_22 = a32;
        } else {
            ff_12 = ff_1.c;
            wd_22 = a32;
        }
        yb_22.j(ff_12, wd_22.b, new Jd(a52, a42, a32.M), a32.C, a2);
        if (!a32.D) {
            if (a7.A && a7.H && ((Zc)a7.B.M).M) {
                if (((Zc)a7.B.M).B.boolean_E()) {
                    yb_2 yb_23 = a7;
                    yb_23.D.E(((Zc)yb_23.B.M).B.E(((ze_2)((Object)a7.M)).D, se_0.E("+M\u0001\u001e#S\b_\u0006_\u0004]\u000f"), a42, a52, a32.D));
                }
                if (((Zc)a7.B.M).A == df_1.c) {
                    yb_2 yb_24 = a7;
                    yb_24.D.j(((ze_2)((Object)yb_24.M)).M, String.format(go.E("\u0002~)r'r%p.3\n@\u00003n`n6k-kQ\u0002Wkr?3n`"), a42, a52));
                }
                if (((Zc)a7.B.M).h == df_1.c) {
                    yb_2 yb_25 = a7;
                    if (yb_25.M.E(((ze_2)((Object)yb_25.M)).j)) {
                        a7.j.E(hg_0.j, bf_2.c, a7.E(String.format(se_0.E("\u007f9uJ\u001b\u0019\u001bO\u001eT\u001e(w."), a42), a52));
                        return;
                    }
                }
            }
        } else if (a7.A && a7.H && ((Zc)a7.B.M).M) {
            if (((Zc)a7.B.M).B.boolean_E()) {
                yb_2 yb_26 = a7;
                yb_26.D.E(((Zc)yb_26.B.M).B.E(((ze_2)((Object)a7.M)).D, go.E("Q\"wkZ&q*\u007f*}(v"), a42, a52, a32.D));
            }
            if (((Zc)a7.B.M).A == df_1.c) {
                yb_2 yb_27 = a7;
                yb_27.D.j(((ze_2)((Object)yb_27.M)).M, String.format(se_0.E("w\u0007\\\u000bR\u000bP\t[J|#zJ\u001b\u0019\u001bO\u001eT\u001e+m!\u001e\u000bJJ\u001b\u0019"), a42, a52));
            }
            if (((Zc)a7.B.M).h == df_1.c) {
                yb_2 yb_28 = a7;
                if (yb_28.M.E(((ze_2)((Object)yb_28.M)).j)) {
                    a7.j.E(hg_0.j, bf_2.b, a7.E(String.format(go.E("\tZ\u000f3n`n6k-kR\u0018X"), a42), a52));
                }
            }
        }
    }

    @Override
    public /* synthetic */ void void_E() {
        yb_2 a2;
        yb_2 yb_22 = a2;
        super.void_E();
        yb_22.H = false;
        yb_22.K.E();
    }

    public /* synthetic */ yb_2(String a2, f_0 a3, ze_2 a4, xf_2 a5, s_0 a6) {
        yb_2 a7;
        yb_2 yb_22 = a7;
        yb_2 yb_23 = a7;
        yb_2 yb_24 = a7;
        yb_2 yb_25 = a7;
        super(a3, a4, a6);
        a7.E = 5.0;
        yb_25.A = false;
        yb_25.H = false;
        yb_24.h = 0.0;
        yb_24.c = 0.0;
        yb_23.C = Double.NaN;
        yb_23.D = a5.ttw_tradefinder_ee_0_E();
        a7.j = a7.ttw_tradefinder_cf_2_E();
        a7.B = a3.E((String)a2, a4.M, new Zc());
        yb_22.B.E(a7);
        yb_22.a = a3.E((String)a2, a4.M, new ya_0());
        yb_22.a.E(a7);
        a7.K = new ae_1(((Zc)a7.B.M).b);
        a2 = new Pc(se_0.E("w\u0007\\\u000bR\u000bP\t['[\u0019M\u000fP\r[\u0018"), Arrays.asList(cd.C, cd.c, cd.D), a3.ttw_tradefinder_qc_1_E());
        yb_2 yb_26 = a7;
        yb_26.M = a2.E(null);
        a2 = new Pc(go.E("^*a v?R'v9g8W.e"), Collections.emptyList(), a3.ttw_tradefinder_qc_1_E());
        yb_26.b = a2.E(null);
        yb_26.A = a3.boolean_j();
        yb_26.H = false;
        yb_26.a(ff_1.J);
        yb_26.a(ff_1.V);
        yb_26.a(ff_1.c);
        yb_26.a(ff_1.r);
        yb_26.a(ff_1.A);
        yb_26.a(ff_1.F);
        yb_26.void_E();
        yb_26.E(new cd_2(cd_2.h, a7));
    }

    @Override
    public /* synthetic */ void d(long a2) {
        yb_2 a3;
        a3.l(a2);
    }

    @Override
    public /* synthetic */ void H(long a2) {
        yb_2 a3;
        yb_2 yb_22 = a3;
        int n2 = yb_22.D.int_j();
        int n3 = yb_22.D.int_E();
        if (n2 == ee_0.h || n3 == ee_0.h) {
            return;
        }
        yb_2 yb_23 = a3;
        double d2 = yb_23.double_E(((Zc)yb_23.B.M).c, ((Zc)a3.B.M).E);
        yb_2 yb_24 = a3;
        d2 = (yb_24.h * 9.0 + d2) / 10.0;
        yb_24.E(ff_1.J, (Double)d2, a2);
        if (((Zc)yb_24.B.M).M) {
            a3.j(a2, n2, n3, d2, a3.h);
        }
        if (((Zc)a3.B.M).H) {
            a3.E(a2, n2, n3, d2, a3.h);
        }
        a3.h = d2;
        if (a3.b.boolean_j()) {
            yb_2 yb_25 = a3;
            d2 = yb_25.double_E(((Zc)yb_25.B.M).a, ((Zc)a3.B.M).C);
            yb_2 yb_26 = a3;
            d2 = (yb_26.c * 9.0 + d2) / 10.0;
            yb_26.E(ff_1.V, (Double)d2, a2);
            yb_26.c = d2;
        }
    }

    private /* synthetic */ double double_E(int a2, int a3) {
        yb_2 a4;
        int n2 = a4.int_E(a2, a3);
        if (n2 == 0) {
            return 0.0;
        }
        sf_0 sf_02 = new sf_0(n2);
        sf_0 sf_03 = new sf_0(n2);
        yb_2 yb_22 = a4;
        sf_0 sf_04 = sf_02;
        yb_22.D.E(sf_04, a2, a3);
        sf_0 sf_05 = sf_03;
        yb_22.D.j(sf_05, a2, a3);
        long l2 = sf_04.E();
        long l3 = sf_05.E();
        double d2 = Math.min(l2, l3);
        double d3 = 0.0;
        if (d2 != 0.0) {
            d3 = 100.0 / d2 * (double)Math.abs(l2 - l3);
            if (l2 < l3) {
                d3 = -d3;
            }
        }
        return d3;
    }

    @Override
    public /* synthetic */ void E(pf_0 a2) {
        yb_2 a3;
        if (a2 == pf_0.I) {
            yb_2 yb_22 = a3;
            yb_22.j(ff_1.c, oe_1.M, ((Zc)yb_22.B.M).M);
            yb_2 yb_23 = a3;
            yb_23.j(ff_1.r, oe_1.M, ((Zc)yb_23.B.M).M);
            return;
        }
        if (a2 == pf_0.i) {
            yb_2 yb_24 = a3;
            yb_24.j(ff_1.A, oe_1.M, ((Zc)yb_24.B.M).H);
            yb_2 yb_25 = a3;
            yb_25.j(ff_1.F, oe_1.M, ((Zc)yb_25.B.M).H);
            return;
        }
        if (a2 == pf_0.h) {
            yb_2 yb_26 = a3;
            yb_26.j(ff_1.J, oe_1.M, ((ya_0)yb_26.a.M).M);
            yb_2 yb_27 = a3;
            yb_27.j(ff_1.V, oe_1.M, ((ya_0)yb_27.a.M).c);
            return;
        }
        if (a2 == pf_0.l) {
            yb_2 yb_28 = a3;
            yb_28.K.E(((Zc)yb_28.B.M).b);
        }
    }

    @Override
    public /* synthetic */ void void_j() {
        yb_2 a2;
        yb_2 yb_22 = a2;
        super.void_j();
        yb_22.M.void_E();
        yb_22.b.void_E();
        yb_22.j.E();
        yb_22.B.j(a2);
        yb_22.a.j(a2);
        yb_22.K.E();
    }

    private /* synthetic */ int int_E(int a2, int a3) {
        if ((a2 = Math.max(0, a3 - a2)) == 0) {
            return 0;
        }
        if (a2 < 6) {
            return a2;
        }
        if (a2 < 20) {
            return (int)((double)a2 * 0.4);
        }
        if (a2 < 50) {
            return (int)((double)a2 * 0.3);
        }
        return (int)((double)a2 * 0.2);
    }

    private /* synthetic */ void E(long a2, int a3, int a4, double a5, double a622) {
        boolean bl;
        yb_2 a7;
        boolean a622 = false;
        if (Double.isNaN(a7.C)) {
            bl = a622 = Math.abs(a5) > 5.0;
        } else {
            if (a7.C < 0.0 && a5 < a7.C || a7.C > 0.0 && a5 > a7.C) {
                a622 = true;
            }
            bl = a622;
        }
        if (bl) {
            if (a5 > 0.0) {
                yb_2 yb_22 = a7;
                String a622 = ((ze_2)((Object)yb_22.M)).java_lang_String_j(a3);
                yb_22.C = -5.0;
                yb_22.j(ff_1.A, a3, new Jd(a622, "", (float)(Math.abs(a5) / 10.0)), a2);
                if (yb_22.A && a7.H && ((Zc)a7.B.M).H) {
                    if (((Zc)a7.B.M).D.boolean_E()) {
                        yb_2 yb_23 = a7;
                        yb_23.D.E(((Zc)yb_23.B.M).D.E(((ze_2)((Object)a7.M)).D, se_0.E("+M\u0001\u001e#S\b_\u0006_\u0004]\u000f\u001e0[\u0018Q\tL\u0005M\u0019"), "", a622, a5 > 0.0));
                    }
                    if (((Zc)a7.B.M).K == df_1.c) {
                        yb_2 yb_24 = a7;
                        yb_24.D.j(((ze_2)((Object)yb_24.M)).M, String.format(go.E("\u0002~)r'r%p.3\n@\u000031v9|fp9|8`kr?3n`"), a622));
                    }
                    if (((Zc)a7.B.M).j == df_1.c) {
                        yb_2 yb_25 = a7;
                        if (yb_25.M.E(((ze_2)((Object)yb_25.M)).j)) {
                            a7.j.E(hg_0.C, bf_2.c, Collections.singletonMap(se_0.E(":L\u0003]\u000f"), a622));
                        }
                    }
                }
                return;
            }
            yb_2 yb_26 = a7;
            String a622 = ((ze_2)((Object)yb_26.M)).java_lang_String_j(a4);
            yb_26.C = 5.0;
            yb_26.j(ff_1.F, a4, new Jd(a622, "", (float)(Math.abs(a5) / 10.0)), a2);
            if (yb_26.A && a7.H && ((Zc)a7.B.M).H) {
                if (((Zc)a7.B.M).D.boolean_E()) {
                    yb_2 yb_27 = a7;
                    yb_27.D.E(((Zc)yb_27.B.M).D.E(((ze_2)((Object)a7.M)).D, go.E("Q\"wkZ&q*\u007f*}(vkI.a$p9|8`"), "", a622, a5 <= 0.0));
                }
                if (((Zc)a7.B.M).K == df_1.c) {
                    yb_2 yb_28 = a7;
                    yb_28.D.j(((ze_2)((Object)yb_28.M)).M, String.format(se_0.E("w\u0007\\\u000bR\u000bP\t[J|#zJD\u000fL\u0005\u0013\tL\u0005M\u0019\u001e\u000bJJ\u001b\u0019"), a622));
                }
                if (((Zc)a7.B.M).j == df_1.c) {
                    yb_2 yb_29 = a7;
                    if (yb_29.M.E(((ze_2)((Object)yb_29.M)).j)) {
                        a7.j.E(hg_0.C, bf_2.b, Collections.singletonMap(go.E("C9z(v"), a622));
                    }
                }
            }
        }
    }

    @Override
    public /* synthetic */ void a() {
        yb_2 a2;
        if (a2.H) {
            return;
        }
        a2.H = true;
        a2.E(oe_1.b, a2.H);
    }

    private /* synthetic */ Map<String, String> E(String a2, String a3) {
        HashMap<String, String> hashMap = new HashMap<String, String>();
        hashMap.put(se_0.E("#S\b_\u0006_\u0004]\u000f"), a2);
        hashMap.put(go.E("C9z(v"), a3);
        return hashMap;
    }

    @Override
    public /* synthetic */ boolean E(ff_1 a2, oe_1 a3) {
        yb_2 a4;
        if (a3 == oe_1.M) {
            if (a2 == ff_1.c || a2 == ff_1.r) {
                return ((Zc)a4.B.M).M;
            }
            if (a2 == ff_1.A || a2 == ff_1.F) {
                return ((Zc)a4.B.M).H;
            }
            if (a2 == ff_1.J) {
                return ((ya_0)a4.a.M).M;
            }
            if (a2 == ff_1.V) {
                return ((ya_0)a4.a.M).c;
            }
        } else {
            if (a3 == oe_1.c) {
                return true;
            }
            if (a3 == oe_1.b) {
                return a4.H;
            }
        }
        return true;
    }
}

