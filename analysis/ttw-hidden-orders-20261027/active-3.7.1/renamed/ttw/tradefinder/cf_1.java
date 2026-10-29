/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.common.VersionHelper
 */
package ttw.tradefinder;

import com.microsoft.applicationinsights.TelemetryClient;
import com.microsoft.applicationinsights.TelemetryConfiguration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.Timer;
import java.util.TimerTask;
import ttw.tradefinder.bC;
import ttw.tradefinder.ce_0;
import ttw.tradefinder.de_1;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ge_2;
import ttw.tradefinder.pe_1;
import ttw.tradefinder.zd_1;
import velox.api.layer1.common.VersionHelper;

/*
 * Renamed from ttw.tradefinder.cF
 */
public class cf_1 {
    private Map<String, Integer> a;
    private final TelemetryClient h;
    private Set<String> H;
    private final Timer D;
    private Map<String, Integer> A;
    private final Object C;
    private Set<String> M;
    private boolean b;
    private final f_0 c;

    public void j(String a2, boolean a3) {
        cf_1 a4;
        Object object = a4.C;
        synchronized (object) {
            Object object2;
            cf_1 cf_12;
            if (!a4.b) {
                return;
            }
            cf_1 cf_13 = a4;
            if (!a4.A.containsKey(a2)) {
                cf_13.A.put((String)a2, 1);
                cf_12 = a4;
            } else {
                String string = a2;
                cf_13.A.put(string, a4.A.get(string) + 1);
                cf_12 = a4;
            }
            int n2 = cf_12.A.get(a2);
            try {
                a2 = new ge_2(a4, (String)a2, n2, a3);
                a4.D.schedule((TimerTask)a2, 3000L);
                object2 = object;
            }
            catch (Exception exception) {
                object2 = object;
            }
            return;
        }
    }

    public void E(String a2, String a3) {
        cf_1 a4;
        a4.h.getContext().getUser$62a2be9b().setAccountId((String)a3);
        a3 = new LinkedHashMap<String, String>();
        ((HashMap)a3).put(bC.E("qnz"), a2);
        a4.h.trackEvent(pe_1.E("34<81.:"), (Map<String, String>)a3, null);
    }

    public void j() {
        cf_1 cf_12;
        cf_1 a2;
        try {
            a2.D.cancel();
            cf_12 = a2;
        }
        catch (Exception exception) {
            cf_12 = a2;
        }
        cf_12.h.trackEvent(bC.E("qvwjfqup"), null, null);
        a2.h.flush();
    }

    public void E() {
        cf_1 a2;
        a2.h.getContext().getUser$62a2be9b().setAccountId(a2.c.ttw_tradefinder_qc_1_E().java_lang_String_a());
        Object object = new LinkedHashMap<String, String>();
        ((HashMap)object).put(pe_1.E("+:/,403r)9"), bC.E("10503>`-"));
        ((HashMap)object).put(pe_1.E("+:/,403r?2"), VersionHelper.getBookmapVersion());
        ((HashMap)object).put(bC.E("oqf{"), a2.c.boolean_j() ? pe_1.E("16+:") : bC.E("p{rrcg"));
        ((HashMap)object).putAll(de_1.E());
        a2.h.trackEvent(pe_1.E(".+<-)r(/"), (Map<String, String>)object, null);
        try {
            object = new zd_1(a2);
            a2.D.schedule((TimerTask)object, 15000L);
            return;
        }
        catch (Exception exception) {
            return;
        }
    }

    public cf_1(f_0 a2) {
        cf_1 a3;
        cf_1 cf_12 = a3;
        cf_1 cf_13 = a3;
        a3.C = new Object();
        a3.h = new TelemetryClient();
        cf_13.D = new Timer(bC.E("FwcylqqwqMavgzwrgl"));
        cf_12.b = false;
        cf_13.A = new HashMap<String, Integer>();
        cf_12.a = new HashMap<String, Integer>();
        cf_12.M = new HashSet<String>();
        cf_12.H = new HashSet<String>();
        a3.c = a2;
        a3.b = false;
        TelemetryConfiguration.getActive().setConnectionString(pe_1.E("\u00163,)-(281)>)621\u0016:$b8kl9m:mlpg;imril;fp>d>krd9>g>=i:e9>gf\u0016388,)621\u001819/263+`7)+-,gpr(8,):(-2/8riq41s>-/16>>)62141.6:7),s>'*/:s<22rd\u00116+:\u001819/263+`7)+-,gpr(8,):(-2/8q16+:96<830.+4<.q0036)0/q<%(-8q>00p"));
        a3.h.getContext().getSession$6a5d2ea2().setId(a3.c.ttw_tradefinder_qc_1_E().java_lang_String_E());
    }

    public void E(String a2, boolean a3) {
        cf_1 a4;
        Object object = a4.C;
        synchronized (object) {
            Object object2;
            cf_1 cf_12;
            if (!a4.b) {
                Object object3;
                cf_1 cf_13 = a4;
                if (a3) {
                    cf_13.M.add((String)a2);
                    object3 = object;
                } else {
                    cf_13.M.remove(a2);
                    object3 = object;
                }
                // ** MonitorExit[v1] (shouldn't be in output)
                return;
            }
            cf_1 cf_14 = a4;
            if (!a4.a.containsKey(a2)) {
                cf_14.a.put((String)a2, 1);
                cf_12 = a4;
            } else {
                String string = a2;
                cf_14.a.put(string, a4.a.get(string) + 1);
                cf_12 = a4;
            }
            int n2 = cf_12.a.get(a2);
            try {
                a2 = new ce_0(a4, (String)a2, n2, a3);
                a4.D.schedule((TimerTask)a2, 3000L);
                object2 = object;
            }
            catch (Exception exception) {
                object2 = object;
            }
            return;
        }
    }
}

