/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  com.google.gson.Gson
 */
package ttw.tradefinder;

import com.google.gson.Gson;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Collections;
import java.util.List;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import ttw.tradefinder.ga_2;
import ttw.tradefinder.ie_0;
import ttw.tradefinder.jb_0;
import ttw.tradefinder.wd_2;

/*
 * Renamed from ttw.tradefinder.FB
 */
public class fb_2 {
    private X509TrustManager b;
    private SSLContext c;

    public /* synthetic */ fb_2() {
        fb_2 a2;
        fb_2 fb_22 = a2;
        fb_22.c = null;
        fb_22.b = null;
    }

    private /* synthetic */ X509TrustManager javax_net_ssl_X509TrustManager_E() {
        fb_2 a2;
        return new ga_2(a2);
    }

    public /* synthetic */ void void_E() {
        fb_2 a2;
        a2.b = a2.javax_net_ssl_X509TrustManager_E();
        try {
            a2.c = SSLContext.getInstance(ie_0.E("2\u000b-"));
            a2.c.init(null, Collections.singletonList(a2.b).toArray(new TrustManager[0]), new SecureRandom());
            return;
        }
        catch (GeneralSecurityException generalSecurityException) {
            a2.c = null;
            generalSecurityException.printStackTrace();
            return;
        }
    }

    public /* synthetic */ boolean E(String a2, String string2, String string3, int i4) {
        return true;
    }

    private /* synthetic */ String java_lang_String_E(String a2) {
        a2 = ((String)a2).getBytes(StandardCharsets.UTF_8);
        return new String((byte[])a2, StandardCharsets.UTF_8);
    }

    private /* synthetic */ boolean boolean_E(String a2) {
        return true;
    }

    public /* synthetic */ List<String> E(String a2, int a322) {
        fb_2 a4;
        if (a4.c == null) {
            throw new Exception(wd_2.E("\"g=w\u001eZ\u0005Q\t@QZ\u001e@Q]\u001f]\u0005]\u0010X\u0018N\u0014P"));
        }
        try {
            int a322;
            a2 = String.format(a4.java_lang_String_E(ie_0.E("D+N9\u00111N?\u0004,L4\b;\u00046\u0012=\u0012g\u0014+\u0004*\\}\u0012")), a4.java_lang_String_E(wd_2.E("\u0019@\u0005D\u0002\u000e^\u001b\u0005@\u0006V\u001cX\u0002\u0019\u0001F\u001eP_U\u000bA\u0003Q\u0006Q\u0013G\u0018@\u0014G_Z\u0014@")), a4.java_lang_String_E((String)a2));
            a2 = new URL((String)a2);
            a2 = ((URL)a2).openConnection();
            a2 = (HttpsURLConnection)a2;
            ((HttpsURLConnection)a2).setSSLSocketFactory(a4.c.getSocketFactory());
            Object object = a2;
            Object object2 = a2;
            ((HttpURLConnection)a2).setRequestMethod(ie_0.E("&\u001d5"));
            ((URLConnection)object2).setConnectTimeout(a322);
            ((URLConnection)object).setReadTimeout(a322);
            ((URLConnection)object2).connect();
            a322 = ((HttpURLConnection)object).getResponseCode();
            switch (a322) {
                case 200: 
                case 201: {
                    String string;
                    a2 = new BufferedReader(new InputStreamReader(((URLConnection)a2).getInputStream()));
                    StringBuilder a322 = new StringBuilder();
                    Object object3 = a2;
                    while ((string = ((BufferedReader)object3).readLine()) != null) {
                        a322.append(string + "\n");
                        object3 = a2;
                    }
                    ((BufferedReader)a2).close();
                    return a4.E(a322.toString());
                }
            }
            throw new Exception("got invalid/unknown response code from license server: " + a322);
        }
        catch (Exception exception) {
            a2 = exception;
            throw exception;
        }
    }

    private /* synthetic */ List<String> E(String a2) {
        jb_0 jb_02 = (jb_0)new Gson().fromJson(a2, jb_0.class);
        if (jb_02 == null) {
            throw new Exception("parse license server list response failed: " + a2);
        }
        return jb_02.E();
    }
}

