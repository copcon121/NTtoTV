/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import javax.net.ssl.X509TrustManager;
import ttw.tradefinder.fb_2;
import ttw.tradefinder.kd_1;
import ttw.tradefinder.sd_1;

/*
 * Renamed from ttw.tradefinder.gA
 */
public class ga_2
implements X509TrustManager {
    public final /* synthetic */ fb_2 c;

    public /* synthetic */ ga_2(fb_2 a2) {
        ga_2 a3;
        a3.c = a2;
    }

    @Override
    public /* synthetic */ void checkServerTrusted(X509Certificate[] a2, String a32) {
        int n2;
        boolean a32 = false;
        boolean bl = false;
        int n3 = a2.length;
        int n4 = n2 = 0;
        while (n4 < n3) {
            X509Certificate x509Certificate = a2[n2];
            if (x509Certificate.getSubjectX500Principal().getName().contains("CN=*.azurewebsites.net")) {
                a32 = true;
            }
            if (x509Certificate.getSubjectX500Principal().getName().contains("CN=Microsoft")) {
                bl = true;
            }
            n4 = ++n2;
        }
        if (!a32 || !bl) {
            throw new CertificateException("expected Microsoft Azure Webservices as principal of the SSL Trust Chain");
        }
    }

    @Override
    public /* synthetic */ X509Certificate[] getAcceptedIssuers() {
        return new X509Certificate[0];
    }

    @Override
    public /* synthetic */ void checkClientTrusted(X509Certificate[] a2, String a3) {
    }
}

