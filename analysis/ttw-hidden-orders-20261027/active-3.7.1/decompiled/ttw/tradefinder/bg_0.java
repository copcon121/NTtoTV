/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.HashMap;
import java.util.Map;
import java.util.StringJoiner;
import ttw.tradefinder.bf_2;
import ttw.tradefinder.ee;
import ttw.tradefinder.fe_1;
import ttw.tradefinder.hg_0;
import ttw.tradefinder.ke_1;
import ttw.tradefinder.tf_2;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.wd_1;

/*
 * Renamed from ttw.tradefinder.bg
 */
public class bg_0 {
    private ke_1 b = new ke_1();
    private static final String c = wa_2.E("9\u00189\u00189");

    public void j(String a2, String a3, String a4) {
        bg_0 a5;
        Object object = new HashMap<String, String>();
        object.put(wa_2.E("IJp[|"), wd_1.E("\u0000x\f|\u001ap"));
        object.put(wa_2.E("nvTlU|"), wd_1.E("\rp\rp\u001ap"));
        StringJoiner stringJoiner = new StringJoiner(System.lineSeparator());
        bg_0 bg_02 = a5;
        bg_02.E(hg_0.d, stringJoiner);
        bg_02.E(hg_0.h, stringJoiner);
        bg_02.E(hg_0.c, stringJoiner);
        bg_02.E(hg_0.j, stringJoiner);
        bg_02.E(hg_0.D, stringJoiner);
        bg_02.E(hg_0.C, stringJoiner);
        bg_02.E(hg_0.A, stringJoiner);
        bg_02.E(hg_0.e, stringJoiner);
        bg_02.E(hg_0.B, stringJoiner);
        bg_02.E(hg_0.H, stringJoiner);
        bg_02.E(hg_0.i, stringJoiner);
        bg_02.E(hg_0.a, stringJoiner);
        bg_02.E(hg_0.E, stringJoiner);
        bg_02.E(hg_0.b, stringJoiner);
        bg_02.E(hg_0.M, stringJoiner);
        bg_02.E(hg_0.k, stringJoiner);
        bg_02.E(hg_0.K, stringJoiner);
        stringJoiner.add(String.format(wa_2.E("\u001dj\u0012<K3\u00029\u001dj"), wd_1.E("i\u0014i\u0014i"), wa_2.E("qwKmJlU|Vm"), ((String)a2).split(wd_1.E("\t"))[0]));
        a2 = object.entrySet().iterator();
        Object object2 = a2;
        while (object2.hasNext()) {
            object = (Map.Entry)a2.next();
            stringJoiner.add(String.format(wa_2.E("\u001dj\u0012<K3\u00029\u001dj"), wd_1.E("i\u0014i\u0014i"), object.getKey(), object.getValue()));
            object2 = a2;
        }
        a5.b.j(new tf_2(a3, a4, stringJoiner.toString()));
    }

    private /* synthetic */ String E(hg_0 a2) {
        switch (a2) {
            case j: 
            case D: 
            case A: {
                while (false) {
                }
                return wa_2.E("]Qk]zLpWw");
            }
        }
        return wd_1.E("g P,");
    }

    public void E(hg_0 a2, bf_2 a3, String a4, String a5, String a6, Map<String, String> a7) {
        bg_0 a8;
        StringJoiner stringJoiner = new StringJoiner(System.lineSeparator());
        stringJoiner.add(a8.j((hg_0)((Object)a2), (bf_2)((Object)a3)));
        stringJoiner.add(String.format(wa_2.E("\u001dj\u0012<K3\u00029\u001dj"), wd_1.E("i\u0014i\u0014i"), wa_2.E("qwKmJlU|Vm"), a4.split(wd_1.E("\t"))[0]));
        stringJoiner.add(String.format(wa_2.E("\u001dj\u0012<K3\u00029\u001dj"), wd_1.E("i\u0014i\u0014i"), a8.E((hg_0)((Object)a2)), a8.E((hg_0)((Object)a2), (bf_2)((Object)a3))));
        a2 = a7.entrySet().iterator();
        Object object = a2;
        while (object.hasNext()) {
            a3 = (Map.Entry)a2.next();
            stringJoiner.add(String.format(wa_2.E("\u001dj\u0012<K3\u00029\u001dj"), wd_1.E("i\u0014i\u0014i"), a3.getKey(), a3.getValue()));
            object = a2;
        }
        a8.b.j(new tf_2(a5, a6, stringJoiner.toString()));
    }

    public void E(String a2, String a3, String a4) {
        bg_0 a5;
        StringJoiner stringJoiner = new StringJoiner(wa_2.E("9"));
        stringJoiner.add(ee.E(fe_1.C));
        stringJoiner.add(a2);
        stringJoiner.add(wd_1.E(" GiF<Z']'SiU'PiF,U-Mi@&\u0014:Q'PiG S'U%Gg"));
        a5.b.j(new tf_2(a3, a4, stringJoiner.toString()));
    }

    /*
     * Enabled aggressive block sorting
     */
    private /* synthetic */ String j(hg_0 a2, bf_2 a3) {
        StringJoiner stringJoiner;
        StringJoiner stringJoiner2 = new StringJoiner(wa_2.E("9"));
        switch (a2) {
            case d: {
                stringJoiner2.add(ee.E(fe_1.c));
                stringJoiner2.add(wd_1.E("\u001d`\u001e\u0014\u0005}\u0018a\u0000p\u0000`\u0010"));
                stringJoiner2.add(ee.E(fe_1.c));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.e : fe_1.m));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case h: {
                stringJoiner2.add(ee.E(fe_1.c));
                stringJoiner2.add(wa_2.E("MlN\u0018UqHmP|Pl@"));
                stringJoiner2.add(ee.E(fe_1.c));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.e : fe_1.m));
                stringJoiner2.add(ee.E(fe_1.M));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case c: {
                stringJoiner2.add(ee.E(fe_1.c));
                stringJoiner2.add(wd_1.E("\u001d`\u001e\u0014\u0005}\u0018a\u0000p\u0000`\u0010"));
                stringJoiner2.add(ee.E(fe_1.c));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.e : fe_1.m));
                stringJoiner2.add(ee.E(fe_1.G));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case j: {
                stringJoiner2.add(ee.E(fe_1.k));
                stringJoiner2.add(wa_2.E("MlN\u0018Pu[yUyW{\\"));
                stringJoiner2.add(ee.E(fe_1.k));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner2.add(ee.E(fe_1.l));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case D: {
                stringJoiner2.add(ee.E(fe_1.k));
                stringJoiner2.add(wd_1.E("\u001d`\u001e\u0014\u0000y\u000bu\u0005u\u0007w\f"));
                stringJoiner2.add(ee.E(fe_1.k));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner2.add(ee.E(fe_1.J));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case C: {
                stringJoiner2.add(ee.E(fe_1.k));
                stringJoiner2.add(wa_2.E("lMo9qTzXtXvZ}9b\\jV\u0015ZjVkJ"));
                stringJoiner2.add(ee.E(fe_1.k));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner2.add(ee.E(fe_1.d));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case A: {
                stringJoiner2.add(ee.E(fe_1.F));
                stringJoiner2.add(wd_1.E("`\u001dcib\u0006x\u001cy\f\u0014\u001ad\u0000\u007f\f"));
                stringJoiner2.add(ee.E(fe_1.F));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case e: {
                stringJoiner2.add(ee.E(fe_1.H));
                stringJoiner2.add(wa_2.E("lMo9pP|]}W\u0018Vj]}K"));
                stringJoiner2.add(ee.E(fe_1.H));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.e : fe_1.m));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case B: {
                stringJoiner2.add(ee.E(fe_1.H));
                stringJoiner2.add(wd_1.E("\u001d`\u001e\u0014\u0000w\fv\ff\u000e\u0014\rq\u001fq\u0005{\u0019y\fz\u001d"));
                stringJoiner2.add(ee.E(fe_1.H));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.e : fe_1.m));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case H: {
                stringJoiner2.add(ee.E(fe_1.K));
                stringJoiner2.add(wa_2.E("MlN\u0018Jo\\}I"));
                stringJoiner2.add(ee.E(fe_1.K));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case i: {
                stringJoiner2.add(ee.E(fe_1.j));
                stringJoiner2.add(wd_1.E("`\u001dciu\u000bg\u0006f\u0019`\u0000{\u0007"));
                stringJoiner2.add(ee.E(fe_1.j));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case a: {
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.f : fe_1.B));
                stringJoiner2.add(wa_2.E("MlN\u0018IjP{\\\u0018Xt\\jM"));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.f : fe_1.B));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case E: {
                stringJoiner2.add(ee.E(fe_1.i));
                stringJoiner2.add(wd_1.E("\u001d`\u001e\u0014\u001f\u0019\rq\u0005`\b"));
                stringJoiner2.add(ee.E(fe_1.i));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case b: {
                stringJoiner2.add(ee.E(fe_1.d));
                stringJoiner2.add(wa_2.E("lMo9n4|\\tMy9b\\jV\u0015ZjVkJ"));
                stringJoiner2.add(ee.E(fe_1.d));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case M: {
                stringJoiner2.add(ee.E(fe_1.i));
                stringJoiner2.add(wd_1.E("`\u001dciy\bf\u0002q\u001d\u0014\u001f{\u0005a\u0004qig\u001d{\u0019"));
                stringJoiner2.add(ee.E(fe_1.i));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
            }
            case k: {
                stringJoiner2.add(ee.E(fe_1.D));
                stringJoiner2.add(wa_2.E("MlN\u0018OwUmT}9kMwI"));
                stringJoiner2.add(ee.E(fe_1.D));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case K: {
                stringJoiner2.add(ee.E(fe_1.D));
                stringJoiner2.add(wd_1.E("`\u001dcig\u001d{\u0019\u0014\u001ba\u0007"));
                stringJoiner2.add(ee.E(fe_1.D));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
            }
        }
        stringJoiner = stringJoiner2;
        return stringJoiner.toString();
    }

    public void E(String a2, String a3) {
        bg_0 a4;
        StringJoiner stringJoiner = new StringJoiner(wd_1.E("i"));
        stringJoiner.add(wa_2.E("3{vV~JxLj\u00149AvM9\\p\\9Qm\u00193"));
        stringJoiner.add(ee.E(fe_1.b));
        stringJoiner.add(wd_1.E("m&A;\u0014c`\u001dciu%Q;@:\u0014\u000b[=\u001ei]:\u0014<DiU'PiF<Z']'Si\u0019iC,\u0014>]:\\iM&AiD;[/]=U+X,\u0014=F(P,Gh"));
        stringJoiner.add(ee.E(fe_1.A));
        a4.b.j(new tf_2(a2, a3, stringJoiner.toString()));
    }

    /*
     * Enabled aggressive block sorting
     */
    private /* synthetic */ String E(hg_0 a2, bf_2 a3) {
        switch (a2) {
            case j: {
                return ee.E(fe_1.l);
            }
            case D: {
                return ee.E(fe_1.J);
            }
            case A: 
            case M: 
            case k: 
            case K: {
                switch (a3) {
                    case c: {
                        return wa_2.E("[m@");
                    }
                }
                return wd_1.E("g\fx\u0005");
            }
        }
        switch (a3) {
            case c: {
                return wa_2.E("XkR");
            }
        }
        return wd_1.E("\u000b}\r");
    }

    public void j() {
        bg_0 a2;
        a2.b.j();
    }

    private /* synthetic */ void E(hg_0 a2, StringJoiner a3) {
        bg_0 a4;
        StringJoiner stringJoiner = a3;
        stringJoiner.add(a4.j(a2, bf_2.c));
        stringJoiner.add(String.format(wa_2.E("\u001dj\u0012<K3\u00029\u001dj"), wd_1.E("i\u0014i\u0014i"), a4.E(a2), a4.E(a2, bf_2.c)));
        a3.add(a4.j(a2, bf_2.b));
        a3.add(String.format(wa_2.E("\u001dj\u0012<K3\u00029\u001dj"), wd_1.E("i\u0014i\u0014i"), a4.E(a2), a4.E(a2, bf_2.b)));
    }

    public bg_0() {
        bg_0 a2;
    }

    public void E() {
        bg_0 a2;
        a2.b.E();
    }
}

