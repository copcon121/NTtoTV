/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.StringUtils
 *  org.apache.commons.lang3.Validate
 */
package a.a.a.a.b;

import java.io.InputStream;
import java.net.URLEncoder;
import java.util.Arrays;
import java.util.stream.IntStream;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.Validate;

public final class a {
    private static final String a = "UTF-8";
    private static final int b = 4096;

    public static String a(String string) {
        String string2 = StringUtils.defaultString((String)string);
        try {
            return URLEncoder.encode(string2, a);
        }
        catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    public static String a(InputStream inputStream) {
        Validate.notNull((Object)inputStream);
        byte[] byArray = new byte[4096];
        int n3 = inputStream.read(byArray);
        int n4 = IntStream.range(0, 4096).filter(n2 -> byArray[n2] == 0).findFirst().orElse(-1);
        boolean bl = n4 >= 0 && IntStream.range(n4, 4096).allMatch(n2 -> byArray[n2] == 0);
        return new String(bl ? Arrays.copyOf(byArray, n4) : byArray);
    }

    private a() {
        throw new InstantiationError();
    }
}

