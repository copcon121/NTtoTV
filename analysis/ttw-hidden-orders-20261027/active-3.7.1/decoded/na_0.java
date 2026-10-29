/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import ttw.tradefinder.ae_1;
import ttw.tradefinder.df_1;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.hL;
import ttw.tradefinder.pe_1;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.va;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.Na
 */
public class na_0 {
    public int H;
    public df_1 D;
    public gf_2 A;
    public boolean C;
    public Color M;
    public String b;
    public df_1 c;

    public na_0() {
        na_0 a2;
        na_0 na_02 = a2;
        na_0 na_03 = a2;
        na_0 na_04 = a2;
        na_04.C = false;
        na_04.H = 0;
        na_03.b = "alert";
        na_02.M = Color.decode("#FF00CC");
        na_03.A = new gf_2(te_1.A, rd_2.H, false);
        na_02.D = df_1.c;
        na_02.c = df_1.c;
    }

    public na_0 E() {
        na_0 a2;
        na_0 na_02 = new na_0();
        new na_0().C = a2.C;
        na_0 na_03 = a2;
        na_0 na_04 = na_02;
        na_0 na_05 = a2;
        na_02.H = na_05.H;
        na_04.b = na_05.b;
        na_04.M = a2.M;
        na_02.A = na_03.A.E();
        na_02.D = na_03.D;
        na_02.c = a2.c;
        return na_02;
    }

    public hL E() {
        na_0 a2;
        hL hL2 = new hL();
        new hL().b = a2.C;
        na_0 na_02 = a2;
        hL hL3 = hL2;
        na_0 na_03 = a2;
        hL2.c = na_03.H;
        hL3.d = na_03.b;
        hL3.g = a2.M;
        hL2.e = na_02.A.E();
        hL2.f = va.E(na_02.D);
        hL2.h = va.E(a2.c);
        return hL2;
    }

    public void E(hL a2) {
        na_0 a3;
        hL hL2 = a2;
        na_0 na_02 = a3;
        na_02.C = a2.b;
        na_02.H = a2.c;
        a3.M = hL2.g;
        if (hL2.d != null) {
            a3.b = a2.d;
        }
        if (a2.e != null) {
            a3.A.E(a2.e);
        }
        if (a2.f != null) {
            a3.D = va.E(a2.f);
        }
        if (a2.h != null) {
            a3.c = va.E(a2.h);
        }
    }
}

