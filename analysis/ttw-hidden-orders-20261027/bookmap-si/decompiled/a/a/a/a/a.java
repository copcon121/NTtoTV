/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.Validate
 *  org.apache.commons.lang3.concurrent.BasicThreadFactory$Builder
 *  velox.api.layer1.common.Log
 *  velox.gui.StrategyPanel
 */
package a.a.a.a;

import a.a.a.a.a.a.c;
import a.a.a.a.a.a.d;
import a.a.a.a.a.a.e;
import a.a.a.a.a.a.f;
import a.a.a.a.b;
import a.a.a.a.d.a;
import java.awt.Container;
import java.awt.LayoutManager;
import java.util.Arrays;
import java.util.Date;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComponent;
import javax.swing.JPanel;
import org.apache.commons.lang3.Validate;
import org.apache.commons.lang3.concurrent.BasicThreadFactory;
import velox.api.layer1.common.Log;
import velox.gui.StrategyPanel;

public final class a {
    private static final String a = "https://t.me/%s";
    private static final String b = "https://t.me/%s?start=subscribe";
    private static final String c = "BotFather";
    private static final String d = "get_id_bot";
    private static final String e = "<bot-username>";
    private static final String f = "Credentials";
    private static final String g = "Enabled";
    private static final String h = "Token";
    private static final String i = "Chat ID";
    private static final String j = "create Telegram bot and obtain the token";
    private static final String k = "obtain chat ID";
    private static final String l = "subscribe / start conversation";
    private static final String m = "Follow further instructions to %s. Please click the button below to open the url in a browser.\nIf you want you can also click the url below to copy it to the clipboard and paste it into a browser by yourselves";
    private static final String n = "Test";
    private static final String o = "Please ensure module is enabled";
    private static final String p = "Please ensure module is properly configured";
    private static final String q = "The text of the message is empty";
    private static final String r = "Telegram API error: %s";
    private static final String s = "Success! Please check your Telegram account for new notifications.";
    private static final String t = "Telegram Notifier";
    private static final String u = "Test message: %s";
    private static final int v = 3;
    private static final int w = 1;
    private static final String x = "Telegram-thread-%d";
    private static final String y = "Telegram: error in executing task";

    public static ExecutorService a() {
        return a.a.a.a.a.a(3);
    }

    public static ExecutorService a(int n2) {
        return Executors.newFixedThreadPool(n2, (ThreadFactory)new BasicThreadFactory.Builder().daemon(true).priority(1).namingPattern(x).build());
    }

    public static StrategyPanel a(a.a.a.a.a.a a2, a.a.a.a.d d2, ExecutorService executorService, Runnable runnable) {
        Validate.notNull((Object)a2);
        Validate.notNull((Object)d2);
        Validate.notNull((Object)executorService);
        Validate.notNull((Object)runnable);
        StrategyPanel strategyPanel = new StrategyPanel(f);
        strategyPanel.setLayout((LayoutManager)new BoxLayout((Container)strategyPanel, 1));
        a.a.a.a.d.a.a((JPanel)strategyPanel, h, d2.getToken(), (String string) -> {
            d2.setToken((String)string);
            runnable.run();
        });
        a.a.a.a.d.a.a((JPanel)strategyPanel, i, d2.getChatId(), (String string) -> {
            d2.setChatId((String)string);
            runnable.run();
        });
        a.a.a.a.d.a.a((JPanel)strategyPanel, String.format(m, j), String.format(a, a.a.a.a.b.a.a(c)));
        a.a.a.a.d.a.a((JPanel)strategyPanel, String.format(m, k), String.format(a, a.a.a.a.b.a.a(d)));
        a.a.a.a.d.a.a((JPanel)strategyPanel, String.format(m, l), String.format(a, e), () -> CompletableFuture.supplyAsync(() -> {
            String string = a.a.a.a.a.a(a2, d2.getToken());
            return string.isEmpty() ? "" : String.format(b, string);
        }, executorService));
        b b2 = a.a.a.a.b.a(string -> a.a.a.a.d.a.a((JComponent)strategyPanel, t, string));
        JButton jButton = new JButton(n);
        jButton.addActionListener(actionEvent -> {
            String string = String.format(u, new Date());
            c c2 = new c(d2.getToken());
            e e2 = new e(c2, d2.getChatId(), string);
            a.a.a.a.a.a(a2, e2, executorService, b2);
        });
        JCheckBox jCheckBox = new JCheckBox(g);
        jCheckBox.setSelected(d2.isEnabled());
        jCheckBox.addActionListener(actionEvent -> {
            d2.setEnabled(jCheckBox.isSelected());
            runnable.run();
        });
        a.a.a.a.d.a.a((JPanel)strategyPanel, Arrays.asList(jButton, jCheckBox), a.a.CENTER);
        return strategyPanel;
    }

    public static void a(a.a.a.a.a.a a2, a.a.a.a.d d2, String string, ExecutorService executorService, b b2) {
        Validate.notNull((Object)a2);
        Validate.notNull((Object)d2);
        Validate.notNull((Object)executorService);
        Validate.notNull((Object)b2);
        if (!d2.isEnabled()) {
            Log.warnFree((Object[])new Object[]{o, d2, string});
            return;
        }
        c c2 = new c(d2.getToken());
        e e2 = new e(c2, d2.getChatId(), string);
        a.a.a.a.a.a(a2, e2, executorService, b2);
    }

    public static void a(a.a.a.a.a.a a2, e e2, ExecutorService executorService, b b2) {
        Validate.notNull((Object)a2);
        Validate.notNull((Object)e2);
        Validate.notNull((Object)executorService);
        Validate.notNull((Object)b2);
        if (e2.c().isEmpty()) {
            Log.warnFree((Object[])new Object[]{q, e2});
            b2.b(q);
            return;
        }
        if (e2.a().a().isEmpty() || e2.b().isEmpty()) {
            Log.warnFree((Object[])new Object[]{p, e2});
            b2.b(p);
            return;
        }
        executorService.execute(() -> {
            try {
                Log.infoFree((Object[])new Object[]{e2});
                f f2 = a2.a(e2);
                Validate.notNull((Object)f2);
                Log.infoFree((Object[])new Object[]{f2});
                d d2 = f2.a();
                if (d2.a()) {
                    b2.a(s);
                } else {
                    b2.b(String.format(r, d2.b()));
                }
            }
            catch (Exception exception) {
                Log.warn((String)y, (Exception)exception);
            }
        });
    }

    public static String a(a.a.a.a.a.a a2, String string) {
        Validate.notNull((Object)a2);
        if (string.isEmpty()) {
            Log.warnFree((Object[])new Object[]{p, string});
            return "";
        }
        try {
            c c2 = new c(string);
            a.a.a.a.a.a.a a3 = new a.a.a.a.a.a.a(c2);
            Log.infoFree((Object[])new Object[]{a3});
            a.a.a.a.a.a.b b2 = a2.a(a3);
            Validate.notNull((Object)b2);
            Log.infoFree((Object[])new Object[]{b2});
            return b2.a().a() ? b2.b() : "";
        }
        catch (Exception exception) {
            Log.warn((String)y, (Exception)exception);
            return "";
        }
    }

    private a() {
        throw new InstantiationError();
    }
}

