/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.SystemUtils
 */
package ttw.tradefinder;

import org.apache.commons.lang3.SystemUtils;
import ttw.tradefinder.ed_0;
import ttw.tradefinder.wd_2;

/*
 * Renamed from ttw.tradefinder.iF
 */
public class if_2 {
    public static void E(String a2) {
        if (a2 == null || a2.isEmpty()) {
            return;
        }
        Runtime runtime = Runtime.getRuntime();
        try {
            if (SystemUtils.IS_OS_WINDOWS) {
                runtime.exec("rundll32 url.dll,FileProtocolHandler " + (String)a2).waitFor();
                return;
            }
            if (SystemUtils.IS_OS_MAC) {
                a2 = new String[]{"open", a2};
                runtime.exec(a2).waitFor();
                return;
            }
            if (SystemUtils.IS_OS_LINUX || SystemUtils.IS_OS_UNIX) {
                a2 = new String[]{"xdg-open", a2};
                runtime.exec(a2).waitFor();
            }
            return;
        }
        catch (Exception exception) {
            return;
        }
    }

    public if_2() {
        if_2 a2;
    }
}

