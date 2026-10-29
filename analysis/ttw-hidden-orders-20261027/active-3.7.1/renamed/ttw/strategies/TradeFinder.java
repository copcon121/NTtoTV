/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.Layer1ApiProvider
 *  velox.api.layer1.annotations.Layer1ApiVersion
 *  velox.api.layer1.annotations.Layer1ApiVersionValue
 *  velox.api.layer1.annotations.Layer1Attachable
 *  velox.api.layer1.annotations.Layer1StrategyName
 *  velox.api.layer1.annotations.UnrestrictedData
 */
package ttw.strategies;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import ttw.tradefinder.Ue;
import ttw.tradefinder.af_0;
import ttw.tradefinder.bC;
import ttw.tradefinder.ba_2;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.cd;
import ttw.tradefinder.cg_0;
import ttw.tradefinder.dE;
import ttw.tradefinder.ea_1;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.fg;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.hf_1;
import ttw.tradefinder.kg;
import ttw.tradefinder.la_2;
import ttw.tradefinder.le_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.mf_1;
import ttw.tradefinder.ne_2;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.ob_1;
import ttw.tradefinder.oc_1;
import ttw.tradefinder.rc_1;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.sd;
import ttw.tradefinder.sf_1;
import ttw.tradefinder.tb_2;
import ttw.tradefinder.ua_1;
import ttw.tradefinder.wa_1;
import ttw.tradefinder.xf_1;
import ttw.tradefinder.z_0;
import ttw.tradefinder.zb_1;
import ttw.tradefinder.ze_2;
import ttw.tradefinder.zf_2;
import velox.api.layer1.Layer1ApiProvider;
import velox.api.layer1.annotations.Layer1ApiVersion;
import velox.api.layer1.annotations.Layer1ApiVersionValue;
import velox.api.layer1.annotations.Layer1Attachable;
import velox.api.layer1.annotations.Layer1StrategyName;
import velox.api.layer1.annotations.UnrestrictedData;

@Layer1Attachable
@Layer1StrategyName(value="TTW-TradeFinder")
@Layer1ApiVersion(value=Layer1ApiVersionValue.VERSION2)
@UnrestrictedData
public class TradeFinder
extends ba_2 {
    @Override
    public void d() {
    }

    public TradeFinder(Layer1ApiProvider a2) {
        super(bC.E("JVI/Jp\u007ff{Dwlzgl"), a2, TradeFinder.class, new wa_1(TradeFinder.E()), Ue.E());
        TradeFinder a3;
    }

    @Override
    public List<z_0> j() {
        TradeFinder a2;
        dE dE2 = new dE(a2);
        fg fg2 = new fg(a2);
        gd_0 gd_02 = new gd_0(a2);
        lg lg2 = new lg(a2);
        ArrayList<z_0> arrayList = new kg();
        bb_1 bb_12 = new bb_1(a2, ((kg)((Object)arrayList)).E(ff_1.O));
        Object object = new Ue(dE2);
        Object object2 = new ff_0(fg2);
        Object object3 = new le_0(gd_02);
        Object object4 = new cg_0(lg2);
        ea_1 ea_12 = new ea_1(a2, ((Ue)object).E(ff_1.P));
        ea_1 ea_13 = new ea_1(a2, ((Ue)object).E(ff_1.u));
        rc_1 rc_12 = new rc_1((f_0)a2, ((Ue)object).E(ff_1.t), true);
        rc_1 rc_13 = new rc_1((f_0)a2, ((Ue)object).E(ff_1.m), true);
        ua_1 ua_12 = new ua_1(a2, ((Ue)object).E(ff_1.U));
        ob_1 ob_12 = new ob_1(a2, ((Ue)object).E(ff_1.s));
        oc_1 oc_12 = new oc_1(a2, ((Ue)object).E(ff_1.Ba));
        rc_1 rc_14 = new rc_1((f_0)a2, ((cg_0)object4).E(ff_1.v), true);
        rc_1 rc_15 = new rc_1((f_0)a2, ((cg_0)object4).E(ff_1.ga), true);
        rc_1 rc_16 = new rc_1((f_0)a2, ((cg_0)object4).E(ff_1.B), true);
        rc_1 rc_17 = new rc_1((f_0)a2, ((cg_0)object4).E(ff_1.ia), true);
        rc_1 rc_18 = new rc_1((f_0)a2, ((cg_0)object4).E(ff_1.Q), true);
        rc_1 rc_19 = new rc_1((f_0)a2, ((cg_0)object4).E(ff_1.f), true);
        rc_1 rc_110 = new rc_1((f_0)a2, ((cg_0)object4).E(ff_1.i), true);
        rc_1 rc_111 = new rc_1((f_0)a2, ((cg_0)object4).E(ff_1.q), true);
        zb_1 zb_12 = new zb_1(a2, ((cg_0)object4).E(ff_1.Ga));
        tb_2 tb_22 = new tb_2((f_0)a2, ((cg_0)object4).E(ff_1.R), true);
        tb_2 tb_23 = new tb_2((f_0)a2, ((cg_0)object4).E(ff_1.I), true);
        tb_2 tb_24 = new tb_2((f_0)a2, ((cg_0)object4).E(ff_1.da), true);
        tb_2 tb_25 = new tb_2((f_0)a2, ((cg_0)object4).E(ff_1.Ca), true);
        tb_2 tb_26 = new tb_2((f_0)a2, ((cg_0)object4).E(ff_1.k), true);
        tb_2 tb_27 = new tb_2((f_0)a2, ((cg_0)object4).E(ff_1.Ka), true);
        zb_1 zb_13 = new zb_1(a2, ((cg_0)object4).E(ff_1.h));
        sd sd2 = new sd(a2, ((cg_0)object4).E(ff_1.d));
        ea_1 ea_14 = new ea_1(a2, ((cg_0)object4).E(ff_1.L));
        ea_1 ea_15 = new ea_1(a2, ((cg_0)object4).E(ff_1.ha));
        zb_1 zb_14 = new zb_1(a2, ((ff_0)object2).E(ff_1.J));
        zb_1 zb_15 = new zb_1(a2, ((ff_0)object2).E(ff_1.V));
        tb_2 tb_28 = new tb_2((f_0)a2, ((ff_0)object2).E(ff_1.c), true);
        tb_2 tb_29 = new tb_2((f_0)a2, ((ff_0)object2).E(ff_1.r), true);
        tb_2 tb_210 = new tb_2((f_0)a2, ((ff_0)object2).E(ff_1.A), true);
        tb_2 tb_211 = new tb_2((f_0)a2, ((ff_0)object2).E(ff_1.F), true);
        Object object5 = new hf_1();
        ((hf_1)object5).E(ea_12);
        ((hf_1)object5).E(ea_13);
        object5 = new tb_2((f_0)a2, ((le_0)object3).E(ff_1.G), true);
        tb_2 tb_212 = new tb_2((f_0)a2, ((le_0)object3).E(ff_1.S), true);
        tb_2 tb_213 = new tb_2((f_0)a2, ((le_0)object3).E(ff_1.N), true);
        tb_2 tb_214 = new tb_2((f_0)a2, ((le_0)object3).E(ff_1.M), true);
        tb_2 tb_215 = new tb_2((f_0)a2, ((le_0)object3).E(ff_1.n), true);
        tb_2 tb_216 = new tb_2((f_0)a2, ((le_0)object3).E(ff_1.D), true);
        la_2 la_22 = new la_2(a2, ((le_0)object3).E(ff_1.o));
        zb_1 zb_16 = new zb_1(a2, ((le_0)object3).E(ff_1.Ha));
        ua_1 ua_13 = new ua_1(a2, ((le_0)object3).E(ff_1.C));
        gd_02.E(la_22);
        ua_13.E(true, true);
        ne_2 ne_22 = new ne_2(a2, ((Ue)object).E(sf_1.B), 2);
        ne_22.E(dE2, nf_0.F);
        ne_2 ne_23 = ne_22;
        ne_23.E(ea_12, nf_0.r);
        ne_23.E(ea_13, nf_0.r);
        ne_2 ne_24 = new ne_2(a2, ((Ue)object).E(sf_1.a), 3);
        ne_24.E(dE2, nf_0.C);
        ne_2 ne_25 = ne_24;
        ne_2 ne_26 = ne_24;
        ne_26.E(rc_12);
        ne_26.E(rc_13);
        ne_25.E(dE2, nf_0.k);
        ne_25.E(dE2, nf_0.m);
        ne_2 ne_27 = new ne_2(a2, ((Ue)object).E(sf_1.N), 4);
        ne_27.E(oc_12, nf_0.C);
        ne_27.E(oc_12, nf_0.Ga);
        ne_2 ne_28 = new ne_2(a2, ((Ue)object).E(sf_1.Y), 5);
        ne_28.E(ob_12, nf_0.C);
        ne_2 ne_29 = ne_28;
        ob_1 ob_13 = ob_12;
        ne_28.E(ob_13, nf_0.a);
        ne_29.E(ob_13, nf_0.m);
        ne_29.E(ob_12, nf_0.e);
        object = new ne_2(a2, ((Ue)object).E(sf_1.D), 6);
        ((ne_2)object).E(dE2, nf_0.L);
        ((ne_2)object).E(ua_12, nf_0.E);
        ne_2 ne_210 = new ne_2(a2, ((cg_0)object4).E(sf_1.Q), 7);
        ne_210.E(lg2, nf_0.da);
        ne_210.E(zb_12, nf_0.r);
        ne_2 ne_211 = new ne_2(a2, ((cg_0)object4).E(sf_1.e), 8);
        ne_211.E(lg2, nf_0.Ha);
        ne_2 ne_212 = ne_211;
        ne_2 ne_213 = ne_211;
        ne_213.E(lg2, nf_0.Z);
        ne_213.E(tb_22);
        ne_212.E(tb_23);
        ne_212.E(lg2, nf_0.G);
        ne_2 ne_214 = new ne_2(a2, ((cg_0)object4).E(sf_1.R), 9);
        ne_214.E(lg2, nf_0.f);
        ne_2 ne_215 = ne_214;
        ne_2 ne_216 = ne_214;
        ne_216.E(lg2, nf_0.N);
        ne_216.E(tb_24);
        ne_215.E(tb_25);
        ne_215.E(lg2, nf_0.A);
        ne_2 ne_217 = new ne_2(a2, ((cg_0)object4).E(sf_1.z), 10);
        ne_217.E(lg2, nf_0.W);
        ne_2 ne_218 = ne_217;
        ne_218.E(lg2, nf_0.l);
        ne_218.E(zb_13, nf_0.r);
        ne_2 ne_219 = new ne_2(a2, ((cg_0)object4).E(sf_1.m), 11);
        ne_219.E(lg2, nf_0.y);
        ne_2 ne_220 = ne_219;
        ne_2 ne_221 = ne_219;
        ne_221.E(lg2, nf_0.t);
        ne_221.E(tb_26);
        ne_220.E(tb_27);
        ne_220.E(lg2, nf_0.D);
        ne_2 ne_222 = new ne_2(a2, ((cg_0)object4).E(sf_1.u), 12);
        ne_222.E(lg2, nf_0.p);
        ne_2 ne_223 = ne_222;
        ne_2 ne_224 = ne_222;
        ne_224.E(rc_18);
        ne_224.E(rc_19);
        ne_223.E(lg2, nf_0.I);
        ne_223.E(lg2, nf_0.S);
        ne_2 ne_225 = new ne_2(a2, ((cg_0)object4).E(sf_1.d), 13);
        ne_225.E(lg2, nf_0.j);
        ne_2 ne_226 = ne_225;
        ne_2 ne_227 = ne_225;
        ne_227.E(rc_16);
        ne_227.E(rc_17);
        ne_226.E(lg2, nf_0.Q);
        ne_226.E(lg2, nf_0.X);
        ne_2 ne_228 = new ne_2(a2, ((cg_0)object4).E(sf_1.V), 14);
        ne_228.E(lg2, nf_0.C);
        ne_2 ne_229 = ne_228;
        ne_2 ne_230 = ne_228;
        ne_230.E(rc_14);
        ne_230.E(rc_15);
        ne_229.E(lg2, nf_0.k);
        ne_229.E(lg2, nf_0.m);
        ne_2 ne_231 = new ne_2(a2, ((cg_0)object4).E(sf_1.T), 15);
        ne_231.E(lg2, nf_0.v);
        ne_2 ne_232 = ne_231;
        ne_2 ne_233 = ne_231;
        ne_233.E(rc_110);
        ne_233.E(rc_111);
        ne_232.E(lg2, nf_0.P);
        ne_232.E(lg2, nf_0.x);
        ne_2 ne_234 = new ne_2(a2, ((ff_0)object2).E(sf_1.n), 16);
        ne_234.E(fg2, nf_0.o);
        ne_2 ne_235 = ne_234;
        ne_235.E(zb_14, nf_0.r);
        ne_235.E(fg2, nf_0.K);
        ne_2 ne_236 = new ne_2(a2, ((ff_0)object2).E(sf_1.L), 17);
        ne_236.E(fg2, nf_0.T);
        ne_2 ne_237 = ne_236;
        ne_236.E(tb_28);
        ne_237.E(tb_29);
        ne_237.E(fg2, nf_0.H);
        ne_2 ne_238 = new ne_2(a2, ((ff_0)object2).E(sf_1.H), 18);
        ne_238.E(fg2, nf_0.B);
        ne_2 ne_239 = ne_238;
        ne_238.E(tb_210);
        ne_239.E(tb_211);
        ne_239.E(fg2, nf_0.J);
        object2 = new ne_2(a2, ((ff_0)object2).E(sf_1.b), 19);
        ((ne_2)object2).E(fg2, nf_0.c);
        Object object6 = object2;
        ((ne_2)object6).E(zb_15, nf_0.r);
        ((ne_2)object6).E(fg2, nf_0.d);
        ne_2 ne_240 = new ne_2(a2, ((le_0)object3).E(sf_1.I), 20);
        ne_240.E(gd_02, nf_0.s);
        ne_2 ne_241 = ne_240;
        ne_2 ne_242 = ne_240;
        ne_2 ne_243 = ne_240;
        ne_243.E((z_0)object5);
        ne_243.E(tb_212);
        ne_242.E(tb_213);
        ne_242.E(tb_214);
        ne_241.E(gd_02, nf_0.i);
        ne_241.E(gd_02, nf_0.h);
        ne_2 ne_244 = new ne_2(a2, ((le_0)object3).E(sf_1.C), 21);
        ne_244.E(gd_02, nf_0.ga);
        ne_2 ne_245 = ne_244;
        ne_2 ne_246 = ne_244;
        ne_246.E(tb_215);
        ne_246.E(tb_216);
        ne_245.E(gd_02, nf_0.u);
        ne_245.E(gd_02, nf_0.w);
        ne_2 ne_247 = new ne_2(a2, ((le_0)object3).E(sf_1.i), 22);
        ne_247.E(gd_02, nf_0.Y);
        ne_247.E(zb_16, nf_0.r);
        ne_2 ne_248 = new ne_2(a2, ((le_0)object3).E(sf_1.g), 23);
        ne_248.E(gd_02, nf_0.V);
        ne_248.E(ua_13, nf_0.E);
        ne_2 ne_249 = new ne_2(a2, ((le_0)object3).E(sf_1.k), 24);
        ne_249.E(la_22, nf_0.q);
        ne_2 ne_250 = new ne_2(a2, ((le_0)object3).E(sf_1.X), 25);
        ne_250.E(gd_02, nf_0.U);
        object3 = new ne_2(a2, ((le_0)object3).E(sf_1.J), 26);
        ((ne_2)object3).E(gd_02, nf_0.R);
        arrayList = new ne_2(a2, ((kg)((Object)arrayList)).E(sf_1.c), 27);
        ((ne_2)((Object)arrayList)).E(bb_12, nf_0.O);
        ne_2 ne_251 = new ne_2(a2, ((cg_0)object4).E(sf_1.F), 28);
        ne_251.E(lg2, nf_0.Ca);
        ne_251.E(ea_14, nf_0.r);
        object4 = new ne_2(a2, ((cg_0)object4).E(sf_1.A), 29);
        ((ne_2)object4).E(lg2, nf_0.n);
        ((ne_2)object4).E(ea_15, nf_0.r);
        ne_2 ne_252 = new ne_2(a2, new zf_2(sf_1.l), 2, xf_1.C, af_0.D);
        ne_252.E(ne_22);
        ne_2 ne_253 = ne_252;
        ne_2 ne_254 = ne_252;
        ne_254.E(ne_24);
        ne_254.E(ne_27);
        ne_253.E(ne_28);
        ne_253.E((ne_2)object);
        object = new ne_2(a2, new zf_2(sf_1.E), 3, xf_1.C, af_0.a);
        ((ne_2)object).E(ne_210);
        Object object7 = object;
        Object object8 = object;
        Object object9 = object;
        Object object10 = object;
        ((ne_2)object10).E(ne_211);
        ((ne_2)object10).E(ne_214);
        ((ne_2)object9).E(ne_217);
        ((ne_2)object9).E(ne_219);
        ((ne_2)object8).E(ne_222);
        ((ne_2)object8).E(ne_225);
        ((ne_2)object7).E(ne_228);
        ((ne_2)object7).E(ne_231);
        ne_22 = new ne_2(a2, new zf_2(sf_1.j), 4, xf_1.C, af_0.E);
        ne_22.E(ne_240);
        ne_2 ne_255 = ne_22;
        ne_2 ne_256 = ne_22;
        ne_2 ne_257 = ne_22;
        ne_257.E(ne_244);
        ne_257.E(ne_247);
        ne_256.E(ne_248);
        ne_256.E(ne_249);
        ne_255.E(ne_250);
        ne_255.E((ne_2)object3);
        object3 = new ne_2(a2, new zf_2(sf_1.U), 5, xf_1.C, af_0.c);
        ((ne_2)object3).E(ne_234);
        Object object11 = object3;
        ((ne_2)object3).E(ne_236);
        ((ne_2)object11).E(ne_238);
        ((ne_2)object11).E((ne_2)object2);
        object2 = new ne_2(a2, new zf_2(sf_1.M), 6, xf_1.C, af_0.C);
        ((ne_2)object2).E((ne_2)((Object)arrayList));
        arrayList = new ne_2(a2, new zf_2(sf_1.K), 7, xf_1.C, af_0.k);
        ((ne_2)((Object)arrayList)).E(ne_251);
        ((ne_2)((Object)arrayList)).E((ne_2)object4);
        object4 = new ne_2(a2, new zf_2(sf_1.h), 2);
        ((ne_2)object4).E(ne_252, false);
        Object object12 = object4;
        Object object13 = object4;
        ((ne_2)object13).E((ne_2)object, false);
        ((ne_2)object13).E(ne_22, false);
        ((ne_2)object12).E((ne_2)object3, false);
        ((ne_2)object12).E((ne_2)((Object)arrayList), false);
        if (a2.boolean_j()) {
            ((ne_2)object4).E((ne_2)object2, false);
        }
        arrayList = new ArrayList<z_0>();
        arrayList.add(dE2);
        arrayList.add(ea_12);
        arrayList.add(ea_13);
        arrayList.add(rc_12);
        arrayList.add(rc_13);
        arrayList.add(ua_12);
        arrayList.add(ob_12);
        arrayList.add(oc_12);
        arrayList.add(lg2);
        arrayList.add(rc_14);
        arrayList.add(rc_15);
        arrayList.add(zb_12);
        arrayList.add(rc_16);
        arrayList.add(rc_17);
        arrayList.add(rc_18);
        arrayList.add(rc_19);
        arrayList.add(rc_110);
        arrayList.add(rc_111);
        arrayList.add(tb_22);
        arrayList.add(tb_23);
        arrayList.add(tb_24);
        arrayList.add(tb_25);
        arrayList.add(zb_13);
        arrayList.add(tb_26);
        arrayList.add(tb_27);
        arrayList.add(sd2);
        arrayList.add(ea_14);
        arrayList.add(ea_15);
        arrayList.add(fg2);
        arrayList.add(zb_14);
        arrayList.add(tb_28);
        arrayList.add(tb_29);
        arrayList.add(tb_210);
        arrayList.add(tb_211);
        arrayList.add(zb_15);
        arrayList.add(gd_02);
        arrayList.add((z_0)object5);
        arrayList.add(tb_212);
        arrayList.add(tb_213);
        arrayList.add(tb_214);
        arrayList.add(tb_215);
        arrayList.add(tb_216);
        arrayList.add(la_22);
        arrayList.add(zb_16);
        arrayList.add(ua_13);
        if (a2.boolean_j()) {
            arrayList.add(bb_12);
        }
        return arrayList;
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2) {
        TradeFinder a3;
        ArrayList<? extends sc_1> arrayList = new ArrayList<sc_1>();
        arrayList.addAll(a3.ttw_tradefinder_ed_2_E().E(a2));
        arrayList.addAll(a3.ttw_tradefinder_qc_1_E().E(a2.M, 1));
        arrayList.addAll(new mf_1(a3, a2).E(999));
        return arrayList;
    }

    private static /* synthetic */ Map<cd, Integer> E() {
        HashMap<cd, Integer> hashMap = new HashMap<cd, Integer>();
        hashMap.put(cd.h, 1);
        hashMap.put(cd.A, 2);
        hashMap.put(cd.D, 3);
        hashMap.put(cd.c, 4);
        hashMap.put(cd.C, 5);
        return hashMap;
    }
}

