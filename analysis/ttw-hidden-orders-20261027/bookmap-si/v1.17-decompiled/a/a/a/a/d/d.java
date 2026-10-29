/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.StringUtils
 *  org.apache.commons.lang3.Validate
 */
package a.a.a.a.d;

import java.awt.Desktop;
import java.awt.Toolkit;
import java.awt.datatransfer.Clipboard;
import java.awt.datatransfer.StringSelection;
import java.net.URI;
import java.util.function.Consumer;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.Validate;

public final class d {
    public static boolean a(String string, Consumer<Exception> consumer) {
        try {
            Clipboard clipboard = Toolkit.getDefaultToolkit().getSystemClipboard();
            if (clipboard != null) {
                clipboard.setContents(new StringSelection(StringUtils.defaultString((String)string)), null);
                return true;
            }
        }
        catch (Exception exception) {
            consumer.accept(exception);
        }
        return false;
    }

    public static void a(URI uRI, Consumer<Exception> consumer) {
        Validate.notNull((Object)uRI);
        Validate.notNull(consumer);
        try {
            Desktop desktop;
            Desktop desktop2 = desktop = Desktop.isDesktopSupported() ? Desktop.getDesktop() : null;
            if (desktop != null && desktop.isSupported(Desktop.Action.BROWSE)) {
                desktop.browse(uRI);
            }
        }
        catch (Exception exception) {
            consumer.accept(exception);
        }
    }

    private d() {
        throw new InstantiationError();
    }
}

