/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.security.cert.X509Certificate;
import javax.net.ssl.X509TrustManager;
import ttw.tradefinder.ke_1;

/*
 * Renamed from ttw.tradefinder.HF
 */
public class hf_2
implements X509TrustManager {
    public final /* synthetic */ ke_1 c;

    @Override
    public X509Certificate[] getAcceptedIssuers() {
        return new X509Certificate[0];
    }

    @Override
    public void checkClientTrusted(X509Certificate[] a2, String a3) {
    }

    public /* synthetic */ hf_2(ke_1 a2) {
        hf_2 a3;
        a3.c = a2;
    }

    @Override
    public void checkServerTrusted(X509Certificate[] a2, String a3) {
    }
}

