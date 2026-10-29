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
    private static String b = "abortthread";
    private BlockingQueue<tf_2> c = new LinkedBlockingQueue<tf_2>();

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    @Override
    public void E(tf_2 a22) {
        if (((tf_2)a22).b.startsWith("g") || ((tf_2)a22).b.startsWith("-")) {
            return;
        }
        try {
            Object object;
            Object object2 = new URL(String.format("https://api.telegram.org/bot%s/sendMessage", ((tf_2)a22).c));
            object2 = ((URL)object2).openConnection();
            object2 = (HttpsURLConnection)object2;
            ((HttpURLConnection)object2).setRequestMethod("POST");
            ((URLConnection)object2).setDoOutput(true);
            Object object3 = new HashMap<String, String>();
            object3.put("chat_id", ((tf_2)a22).b);
            object3.put("parse_mode", "markdown");
            object3.put("text", ((tf_2)a22).M);
            a22 = new StringJoiner("&");
            object3 = object3.entrySet().iterator();
            Object object4 = object3;
            while (object4.hasNext()) {
                object = (Map.Entry)object3.next();
                ((StringJoiner)a22).add(URLEncoder.encode((String)object.getKey(), "UTF-8") + "=" + URLEncoder.encode((String)object.getValue(), "UTF-8"));
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
            SSLContext sSLContext = SSLContext.getInstance("SSL");
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

