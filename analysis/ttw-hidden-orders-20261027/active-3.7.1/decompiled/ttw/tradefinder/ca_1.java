/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import ttw.tradefinder.hJ;
import ttw.tradefinder.hd;
import ttw.tradefinder.he_1;
import ttw.tradefinder.qc_0;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.yb_0;
import ttw.tradefinder.z;
import ttw.tradefinder.za_1;

/*
 * Renamed from ttw.tradefinder.CA
 */
public class ca_1
extends wa_2<hJ> {
    public int j;
    public Color a;
    public hd h;
    public int H;
    public int D;
    public Color A;
    public Color C;
    public qc_0 M;
    public yb_0 b;
    public za_1 c;

    public ca_1(Color a2, Color a3, Color a4, yb_0 a5, qc_0 a6, hd a7, za_1 a8, int a9, int a10, int a11) {
        ca_1 a12;
        ca_1 ca_12 = a12;
        ca_1 ca_13 = a12;
        ca_1 ca_14 = a12;
        ca_1 ca_15 = a12;
        ca_1 ca_16 = a12;
        ca_1 ca_17 = a12;
        ca_1 ca_18 = a12;
        ca_1 ca_19 = a12;
        super(hJ.class);
        a12.b = yb_0.M;
        a12.M = qc_0.A;
        ca_19.h = hd.M;
        ca_19.c = za_1.M;
        ca_19.j = 90;
        ca_18.H = 90;
        ca_17.D = 90;
        ca_18.a = he_1.M;
        ca_17.A = he_1.b;
        ca_17.C = he_1.D;
        ca_16.a = a2;
        ca_16.A = a3;
        ca_15.C = a4;
        ca_15.b = a5;
        ca_14.M = a6;
        ca_14.h = a7;
        ca_13.c = a8;
        ca_13.j = a9;
        ca_12.H = a10;
        ca_12.D = a11;
    }

    public ca_1() {
        a2(he_1.M, he_1.b, he_1.D, yb_0.M, qc_0.A, hd.b, za_1.M, 90, 90, 90);
        ca_1 a2;
    }

    public ca_1(z a2) {
        a3(a2.j(), a2.E(), a2.a(), a2.E(), a2.E(), a2.E(), a2.E(), a2.j(), a2.a(), a2.E());
        ca_1 a3;
    }

    @Override
    public hJ E() {
        ca_1 a2;
        hJ hJ2 = new hJ();
        new hJ().IsDefault = a2.b;
        ca_1 ca_12 = a2;
        hJ hJ3 = hJ2;
        ca_1 ca_13 = a2;
        hJ hJ4 = hJ2;
        ca_1 ca_14 = a2;
        hJ2.b = va.E(a2.b);
        hJ2.c = va.E(ca_14.M);
        hJ4.d = va.E(ca_14.h);
        hJ4.e = va.E(a2.c);
        hJ2.f = ca_13.j;
        hJ3.g = ca_13.H;
        hJ3.h = a2.D;
        hJ2.i = ca_12.a;
        hJ2.j = ca_12.A;
        hJ2.k = a2.C;
        return hJ2;
    }

    @Override
    public void E(hJ a2) {
        hJ hJ2 = a2;
        a.b = (yb_0)hJ2.IsDefault;
        if (hJ2.b != null) {
            a.b = va.E(a2.b);
        }
        if (a2.c != null) {
            a.M = va.E(a2.c);
        }
        if (a2.d != null) {
            a.h = va.E(a2.d);
        }
        if (a2.e != null) {
            a.c = va.E(a2.e);
        }
        if (a2.f != 0) {
            a.j = a2.f;
        }
        if (a2.g != 0) {
            a.H = a2.g;
        }
        if (a2.h != 0) {
            a.D = a2.h;
        }
        if (a2.i != null) {
            a.a = a2.i;
        }
        if (a2.j != null) {
            a.A = a2.j;
        }
        if (a2.k != null) {
            a.C = a2.k;
        }
    }
}

