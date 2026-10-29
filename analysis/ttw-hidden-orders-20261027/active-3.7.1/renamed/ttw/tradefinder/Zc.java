/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.df_1;
import ttw.tradefinder.eM;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

public class Zc
extends wa_2<eM> {
    public gf_2 B;
    public df_1 K;
    public int E;
    public df_1 j;
    public int a;
    public df_1 h;
    public boolean H;
    public gf_2 D;
    public df_1 A;
    public int C;
    public boolean M;
    public int b;
    public int c;

    @Override
    public void E(eM a2) {
        Zc a3;
        eM eM2 = a2;
        Zc zc = a3;
        eM eM3 = a2;
        Zc zc2 = a3;
        eM eM4 = a2;
        a3.b = a2.IsDefault ? 1 : 0;
        a3.b = eM4.c;
        zc2.M = eM4.b;
        zc2.H = a2.g;
        a3.c = eM3.a;
        zc.E = eM3.j;
        zc.a = a2.k;
        a3.C = eM2.m;
        if (eM2.e != null) {
            a3.h = va.E(a2.e);
        }
        if (a2.f != null) {
            a3.A = va.E(a2.f);
        }
        if (a2.d != null) {
            a3.B.E(a2.d);
        }
        if (a2.i != null) {
            a3.j = va.E(a2.i);
        }
        if (a2.l != null) {
            a3.K = va.E(a2.l);
        }
        if (a2.h != null) {
            a3.D.E(a2.h);
        }
    }

    public Zc() {
        Zc a2;
        Zc zc = a2;
        Zc zc2 = a2;
        Zc zc3 = a2;
        Zc zc4 = a2;
        Zc zc5 = a2;
        Zc zc6 = a2;
        super(eM.class);
        zc6.M = true;
        zc5.b = 20;
        zc6.h = df_1.b;
        zc5.A = df_1.b;
        zc4.B = new gf_2(te_1.A, rd_2.M, false);
        zc3.H = false;
        zc4.j = df_1.b;
        zc3.K = df_1.b;
        zc3.D = new gf_2(te_1.A, rd_2.M, false);
        zc2.c = 1;
        zc2.E = 40;
        zc.a = 40;
        zc.C = 80;
    }

    @Override
    public eM E() {
        Zc a2;
        eM eM2 = new eM();
        new eM().IsDefault = a2.b;
        Zc zc = a2;
        eM eM3 = eM2;
        Zc zc2 = a2;
        eM eM4 = eM2;
        Zc zc3 = a2;
        eM eM5 = eM2;
        Zc zc4 = a2;
        eM2.c = a2.b;
        eM2.b = zc4.M;
        eM5.g = zc4.H;
        eM5.a = a2.c;
        eM2.j = zc3.E;
        eM4.k = zc3.a;
        eM4.m = a2.C;
        eM2.e = va.E(zc2.h);
        eM3.f = va.E(zc2.A);
        eM3.d = a2.B.ttw_tradefinder_go_E();
        eM2.i = va.E(zc.j);
        eM2.l = va.E(zc.K);
        eM2.h = a2.D.ttw_tradefinder_go_E();
        return eM2;
    }
}

