/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.common.Log
 *  velox.api.layer1.common.VersionHelper
 */
package velox.indicators.sionchart.a;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.concurrent.TimeUnit;
import javax.swing.JComponent;
import javax.swing.JFormattedTextField;
import javax.swing.JOptionPane;
import javax.swing.JSpinner;
import javax.swing.SwingUtilities;
import javax.swing.text.DefaultFormatter;
import velox.api.layer1.common.Log;
import velox.api.layer1.common.VersionHelper;
import velox.indicators.sionchart.a.l;

public class t {
    private static final SimpleDateFormat a = new SimpleDateFormat("yyyyMMdd HH:mm:ss.SSS");

    public static String a() {
        return a.format(new Date());
    }

    public static String a(long l2) {
        return a.format(new Date(TimeUnit.NANOSECONDS.toMillis(l2)));
    }

    public static void a(String string) {
        System.out.println(t.a() + " " + string);
    }

    public static boolean a(String string, String string2) {
        String string3 = null;
        try {
            string3 = VersionHelper.getBookmapVersion();
        }
        catch (Exception exception) {
            Log.error((String)exception.getMessage());
        }
        try {
            if (string3 == null || !t.b(string3, string)) {
                String string4 = string3 == null ? "" : string3;
                SwingUtilities.invokeLater(() -> {
                    l l2 = new l("This Bookmap version " + string4 + " does not support the " + string2 + ". To download the latest beta version click ", "here", ".", "http://bookmap.com/current/beta");
                    JOptionPane.showMessageDialog(null, l2, "Incompatible version", 1);
                });
                return false;
            }
        }
        catch (Exception exception) {
            throw new RuntimeException("Error while checking Bookmap version: " + exception.getMessage());
        }
        return true;
    }

    public static boolean b(String string, String string2) {
        String[] stringArray = string2.split("\\.");
        String[] stringArray2 = string.split("\\.");
        for (int i2 = 0; i2 < stringArray.length; ++i2) {
            int n2 = Integer.decode(stringArray[i2]);
            int n3 = Integer.decode(stringArray2[i2]);
            if (n3 > n2) {
                return true;
            }
            if (n3 >= n2) continue;
            return false;
        }
        return true;
    }

    public static int a(double d2) {
        int n2 = 0;
        if (d2 < 1.0) {
            BigDecimal bigDecimal = BigDecimal.valueOf(d2);
            while (bigDecimal.doubleValue() % 1.0 > 0.0) {
                bigDecimal = bigDecimal.movePointRight(1);
                ++n2;
            }
        }
        return n2;
    }

    public static void a(JSpinner jSpinner) {
        JComponent jComponent = jSpinner.getEditor();
        JFormattedTextField jFormattedTextField = (JFormattedTextField)jComponent.getComponent(0);
        DefaultFormatter defaultFormatter = (DefaultFormatter)jFormattedTextField.getFormatter();
        defaultFormatter.setCommitsOnValidEdit(true);
    }
}

