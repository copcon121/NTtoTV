/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import ttw.tradefinder.ac_2;
import ttw.tradefinder.if_0;

/*
 * Renamed from ttw.tradefinder.HD
 */
public class hd_1 {
    public static String E(byte[] a2) {
        int n2;
        if (a2.length == 0) {
            return "";
        }
        StringBuffer stringBuffer = new StringBuffer();
        int n3 = n2 = 0;
        while (n3 < a2.length) {
            String string = Integer.toHexString(0xFF & a2[n2]);
            if (string.length() == 1) {
                stringBuffer.append('0');
            }
            stringBuffer.append(string);
            n3 = ++n2;
        }
        return stringBuffer.toString();
    }

    public hd_1() {
        hd_1 a2;
    }

    public static byte[] E(String a2) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(a2.getBytes(StandardCharsets.UTF_8));
        }
        catch (Exception exception) {
            return new byte[0];
        }
    }

    public static String j(String a2, byte[] a3) {
        try {
            a3 = new SecretKeySpec((byte[])a3, "AES");
            Cipher cipher = Cipher.getInstance("AES");
            cipher.init(2, (Key)a3);
            return new String(cipher.doFinal(Base64.getDecoder().decode(a2)));
        }
        catch (Exception exception) {
            return a2;
        }
    }

    public static String E(String a2, byte[] a3) {
        try {
            a3 = new SecretKeySpec((byte[])a3, "AES");
            Cipher cipher = Cipher.getInstance("AES");
            cipher.init(1, (Key)a3);
            a3 = cipher.doFinal(a2.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString((byte[])a3);
        }
        catch (Exception exception) {
            return a2;
        }
    }
}

