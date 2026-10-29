/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.Validate
 */
package a.a.a.a.a;

import a.a.a.a.a.a.a;
import a.a.a.a.a.a.d;
import a.a.a.a.a.a.e;
import a.a.a.a.a.a.f;
import java.net.URL;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;
import javax.net.ssl.HttpsURLConnection;
import org.apache.commons.lang3.Validate;

final class b
implements a.a.a.a.a.a {
    private static final String b = "https://api.telegram.org/bot%s/%s?";
    private static final String c = "&";
    private static final String d = "=";
    private static final String e = "sendMessage";
    private static final String f = "chat_id";
    private static final String g = "text";
    private static final String h = "getMe";
    private static final int i = 5000;
    private static final int j = 200;

    b() {
    }

    private static String a(String string, String string2, Map<String, String> map) {
        String string3 = String.format(b, a.a.a.a.b.a.a(string), a.a.a.a.b.a.a(string2));
        return map.entrySet().stream().map(entry -> String.join((CharSequence)d, a.a.a.a.b.a.a((String)entry.getKey()), a.a.a.a.b.a.a((String)entry.getValue()))).collect(Collectors.joining(c, string3, ""));
    }

    private static d a(String string) {
        HttpsURLConnection httpsURLConnection = (HttpsURLConnection)new URL(string).openConnection();
        httpsURLConnection.setConnectTimeout(5000);
        boolean bl = httpsURLConnection.getResponseCode() == 200;
        String string2 = a.a.a.a.b.a.a(bl ? httpsURLConnection.getInputStream() : httpsURLConnection.getErrorStream());
        return new d(bl, string2);
    }

    @Override
    public f a(e e2) {
        Validate.notNull((Object)e2);
        String string = e2.a().a();
        String string2 = e2.b();
        String string3 = e2.c();
        HashMap<String, String> hashMap = new HashMap<String, String>();
        hashMap.put(f, string2);
        hashMap.put(g, string3);
        String string4 = a.a.a.a.a.b.a(string, e, hashMap);
        d d2 = a.a.a.a.a.b.a(string4);
        return a.a.a.a.a.a.f.a(d2);
    }

    @Override
    public a.a.a.a.a.a.b a(a a2) {
        Validate.notNull((Object)a2);
        String string = a2.a().a();
        String string2 = a.a.a.a.a.b.a(string, h, Collections.emptyMap());
        d d2 = a.a.a.a.a.b.a(string2);
        return a.a.a.a.a.a.b.a(d2);
    }
}

