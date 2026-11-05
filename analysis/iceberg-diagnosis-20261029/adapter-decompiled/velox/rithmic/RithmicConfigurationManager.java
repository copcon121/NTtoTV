/*
 * Decompiled with CFR 0.152.
 */
package velox.rithmic;

import java.io.InputStream;
import java.util.Scanner;
import java.util.TreeMap;
import java.util.stream.Stream;

public class RithmicConfigurationManager {
    private static final String[] a = new String[]{"Rithmic Paper Trading", "TheTradingPit"};
    private static final TreeMap<String, String> b = new TreeMap();
    private static final TreeMap<String, String> c = new TreeMap();
    private static boolean d = false;

    public static void initialize(String string, String string2) {
        InputStream inputStream = RithmicConfigurationManager.class.getClassLoader().getResourceAsStream("rithmic/rithmicparams.txt");
        try (Scanner scanner = new Scanner(inputStream);){
            while (scanner.hasNext()) {
                scanner.useDelimiter("========================================");
                String string3 = scanner.next().replace("<base-path>", string).replace("<logs-path>", string2).replace("\r\n", "\n").trim();
                String[] stringArray = string3.split("----------------------------------------");
                String string4 = stringArray[0].trim();
                String string5 = stringArray[1].trim();
                String string6 = stringArray[2].trim();
                b.put(string4, string5);
                c.put(string4, string6);
            }
        }
        d = true;
    }

    static String a(String string) {
        if (!d) {
            throw new RuntimeException("Not initialized");
        }
        return b.get(string);
    }

    static String b(String string) {
        if (!d) {
            throw new RuntimeException("Not initialized");
        }
        return c.get(string);
    }

    public static String[] a() {
        if (!d) {
            throw new RuntimeException("Not initialized");
        }
        return b.keySet().toArray(new String[0]);
    }

    public static boolean c(String string) {
        return string != null && Stream.of(a).anyMatch(string2 -> string.startsWith(string2 + "|") || string.equals(string2));
    }
}

