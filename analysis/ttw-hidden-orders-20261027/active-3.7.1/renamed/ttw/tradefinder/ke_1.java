/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.StringJoiner;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import ttw.tradefinder.Ff;
import ttw.tradefinder.fg_0;
import ttw.tradefinder.hf_2;
import ttw.tradefinder.ka_2;
import ttw.tradefinder.nd_2;
import ttw.tradefinder.tf_2;

/*
 * Renamed from ttw.tradefinder.KE
 */
public class ke_1
implements ka_2 {
    private static String b = Ff.E("C\u0016M\u0006V\u0000J\u0006G\u0015F");
    private BlockingQueue<tf_2> c = new LinkedBlockingQueue<tf_2>();

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    @Override
    public void E(tf_2 a22) {
        if (((tf_2)a22).b.startsWith(nd_2.E("^")) || ((tf_2)a22).b.startsWith(Ff.E("\u000f"))) {
            return;
        }
        try {
            Object object;
            Object object2 = new URL(String.format(nd_2.E("BM^IY\u0003\u0005\u0016KIC\u0017^\\F\\MKKT\u0004VX^\u0005[EM\u000fJ\u0005JOWNtOJYXM\\"), ((tf_2)a22).c));
            object2 = ((URL)object2).openConnection();
            object2 = (HttpsURLConnection)object2;
            ((HttpURLConnection)object2).setRequestMethod(Ff.E("$m'v"));
            ((URLConnection)object2).setDoOutput(true);
            Object object3 = new HashMap<String, String>();
            object3.put(nd_2.E("ZBX^fC]"), ((tf_2)a22).b);
            object3.put(Ff.E("\u0004C\u0006Q\u0011}\u0019M\u0010G"), nd_2.E("GXXRNV]W"));
            object3.put(Ff.E("\u0000G\fV"), ((tf_2)a22).M);
            a22 = new StringJoiner(nd_2.E("\u001f"));
            object3 = object3.entrySet().iterator();
            Object object4 = object3;
            while (object4.hasNext()) {
                object = (Map.Entry)object3.next();
                ((StringJoiner)a22).add(URLEncoder.encode((String)object.getKey(), Ff.E("w dY\u001a")) + "=" + URLEncoder.encode((String)object.getValue(), nd_2.E("l~\u007f\u0007\u0001")));
                object4 = object3;
            }
            object3 = ((StringJoiner)a22).toString().getBytes(StandardCharsets.UTF_8);
            ((HttpURLConnection)object2).setFixedLengthStreamingMode(((Object)object3).length);
            Object object5 = object2;
            ((URLConnection)object5).connect();
            object = ((URLConnection)object5).getOutputStream();
            try {
                ((OutputStream)object).write((byte[])object3);
                if (object == null) return;
            }
            catch (Throwable a22) {
                Throwable throwable;
                if (object != null) {
                    try {
                        ((OutputStream)object).close();
                        throwable = a22;
                        throw throwable;
                    }
                    catch (Throwable throwable2) {
                        a22.addSuppressed(throwable2);
                    }
                }
                throwable = a22;
                throw throwable;
            }
            ((OutputStream)object).close();
            return;
        }
        catch (Exception exception) {
            return;
        }
    }

    public void j(tf_2 a2) {
        ke_1 a3;
        a3.c.offer(a2);
    }

    public ke_1() {
        ke_1 a2;
        TrustManager[] trustManagerArray = new TrustManager[]{new hf_2(a2)};
        try {
            SSLContext sSLContext = SSLContext.getInstance(Ff.E("q'n"));
            sSLContext.init(null, trustManagerArray, new SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(sSLContext.getSocketFactory());
            return;
        }
        catch (GeneralSecurityException generalSecurityException) {
            return;
        }
    }

    public void j() {
        ke_1 a2;
        a2.c.offer(new tf_2("", "", b));
    }

    public void E() {
        ke_1 a2;
        new Thread(new fg_0(a2.c, b, a2)).start();
    }
}

