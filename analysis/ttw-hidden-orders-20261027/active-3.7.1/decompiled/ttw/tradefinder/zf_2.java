/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Arrays;
import java.util.Collections;
import ttw.tradefinder.Pc;
import ttw.tradefinder.bC;
import ttw.tradefinder.cd;
import ttw.tradefinder.fg_0;
import ttw.tradefinder.hb_0;
import ttw.tradefinder.l;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.sf_1;
import ttw.tradefinder.y;

/*
 * Renamed from ttw.tradefinder.ZF
 */
public class zf_2
implements y {
    private final sf_1 c;

    @Override
    public /* synthetic */ l E(qc_1 a2) {
        zf_2 a3;
        switch (a3.c) {
            case h: {
                return new Pc(a3.c.toString() + " settings", Arrays.asList(cd.h, cd.A, cd.C, cd.c, cd.D), a2);
            }
            case l: {
                return new Pc(a3.c.toString() + " settings", Arrays.asList(cd.h, cd.A, cd.C, cd.c, cd.D), a2);
            }
            case U: {
                return new Pc(a3.c.toString() + " settings", Arrays.asList(cd.C, cd.c, cd.D), a2);
            }
            case j: {
                return new Pc(a3.c.toString() + " settings", Arrays.asList(cd.A, cd.C, cd.c, cd.D), a2);
            }
            case E: {
                new Pc(a3.c.toString() + " settings", Arrays.asList(cd.h, cd.A, cd.C, cd.c, cd.D), a2);
            }
            case M: {
                return new Pc(a3.c.toString() + " settings", Arrays.asList(cd.C, cd.c, cd.D), a2);
            }
            case K: {
                return new Pc(a3.c.toString() + " settings", Collections.emptyList(), a2);
            }
        }
        return new hb_0();
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ boolean E() {
        zf_2 a2;
        switch (a2.c) {
            case M: {
                return false;
            }
        }
        return true;
    }

    /*
     * Enabled aggressive block sorting
     */
    @Override
    public /* synthetic */ String E() {
        zf_2 a2;
        switch (a2.c) {
            case l: {
                return bC.E("VJU3JwfzgpMlf{pm");
            }
            case U: {
                return fg_0.E("$B';9{\u0012w\u001cw\u001eu\u0015B\u0002w\u0013}\u0015d");
            }
            case j: {
                return bC.E("VJU3Nwskkzkj{Jp\u007faugl");
            }
            case E: {
                return fg_0.E("$B';=w\u0002}\u0015b5n\u0000z\u001fd\u0015d");
            }
            case M: {
                return bC.E("VJU3Rlk}g_n{pj");
            }
            case K: {
                return fg_0.E("B$A]E\u0000s\u0015r=s\u0004s\u0002e");
            }
            case h: {
                return bC.E("Q{vjkpem");
            }
        }
        return "";
    }

    public /* synthetic */ zf_2(sf_1 a2) {
        zf_2 a3;
        a3.c = a2;
    }
}

