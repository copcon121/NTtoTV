/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.StringUtils
 *  org.apache.commons.lang3.Validate
 *  velox.api.layer1.common.Log
 */
package a.a.a.a.d;

import a.a.a.a.d.b;
import a.a.a.a.d.c;
import a.a.a.a.d.d;
import java.awt.Cursor;
import java.awt.Font;
import java.awt.Point;
import java.awt.font.TextAttribute;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JWindow;
import javax.swing.SwingUtilities;
import javax.swing.Timer;
import javax.swing.border.EmptyBorder;
import javax.swing.border.TitledBorder;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.Validate;
import velox.api.layer1.common.Log;

public final class a {
    private static final int a = 10;
    private static final char b = '\u0000';
    private static final char c = '*';
    private static final String d = "Show";
    private static final String e = "<html><body style=\"text-align: justify;  text-justify: inter-word;\">%s</body></html>";
    private static final String f = "Copied: %s";
    private static final String g = "Open";
    private static final int h = 30;
    private static final int i = 16;
    private static final int j = 20;
    private static final String k = "Couldn't copy to clipboard";
    private static final String l = "Couldn't open browser";

    private static double a(double d2, double d3) {
        double d4 = Math.max(0.0, d2);
        double d5 = Math.min(1.0, Math.max(0.0, d3));
        return Math.min(d2, Math.max(0.0, d4 * d5 * (3.0 - d5)));
    }

    public static void a(JPanel jPanel, String string, String string2, Consumer<String> consumer) {
        Validate.notNull((Object)jPanel);
        Validate.notEmpty((CharSequence)string);
        Validate.notNull(consumer);
        JPasswordField jPasswordField = new JPasswordField();
        jPasswordField.setEchoChar('*');
        jPasswordField.setText(StringUtils.defaultString((String)string2));
        jPasswordField.getDocument().addDocumentListener(new b(jPasswordField, consumer));
        JCheckBox jCheckBox = new JCheckBox(d);
        jCheckBox.addChangeListener(changeEvent -> jPasswordField.setEchoChar(jCheckBox.isSelected() ? (char)'\u0000' : (char)'*'));
        JPanel jPanel2 = new JPanel();
        jPanel2.setBorder(new TitledBorder(new EmptyBorder(10, 10, 10, 10), string));
        jPanel2.setAlignmentX(0.0f);
        jPanel2.setLayout(new BoxLayout(jPanel2, 0));
        jPanel2.add(jPasswordField);
        jPanel2.add(Box.createHorizontalStrut(10));
        jPanel2.add(jCheckBox);
        jPanel.add(jPanel2);
    }

    public static void a(JPanel jPanel, String string, String string2) {
        a.a.a.a.d.a.a(jPanel, string, string2, () -> null);
    }

    public static void a(JPanel jPanel, String string3, String string4, Supplier<CompletableFuture<String>> supplier) {
        Validate.notNull((Object)jPanel);
        Validate.notEmpty((CharSequence)string3);
        Validate.notEmpty((CharSequence)string4);
        Validate.notNull(supplier);
        JLabel jLabel = new JLabel(String.format(e, string3));
        JLabel jLabel2 = new JLabel(string4);
        UnaryOperator unaryOperator = string2 -> StringUtils.defaultString((String)string2, (String)string4);
        jLabel2.setCursor(Cursor.getPredefinedCursor(12));
        Font font = jLabel2.getFont();
        HashMap hashMap = new HashMap(font.getAttributes());
        hashMap.put(TextAttribute.UNDERLINE, TextAttribute.UNDERLINE_ON);
        jLabel2.setFont(font.deriveFont(hashMap));
        Consumer<String> consumer = a.a.a.a.d.a.a(jLabel2);
        jLabel2.addMouseListener(new c(supplier, string4, unaryOperator, consumer));
        JButton jButton = new JButton(g);
        Consumer<String> consumer2 = string -> a.a.a.a.d.d.a(URI.create(string), (Exception exception) -> Log.warn((String)l, (Exception)exception));
        jButton.addActionListener(actionEvent -> {
            CompletableFuture completableFuture = (CompletableFuture)supplier.get();
            if (completableFuture == null) {
                consumer2.accept(string4);
            } else {
                completableFuture.whenComplete((string, throwable) -> consumer2.accept((String)unaryOperator.apply(string)));
            }
        });
        JPanel jPanel2 = new JPanel();
        jPanel2.setBorder(new EmptyBorder(10, 10, 10, 10));
        jPanel2.setLayout(new BoxLayout(jPanel2, 1));
        jPanel2.setAlignmentX(0.0f);
        jPanel2.add(jLabel);
        jPanel2.add(Box.createVerticalStrut(10));
        jPanel2.add(jLabel2);
        jPanel2.add(Box.createVerticalStrut(10));
        jPanel2.add(jButton);
        jPanel.add(jPanel2);
    }

    public static Consumer<String> a(JComponent jComponent) {
        Validate.notNull((Object)jComponent);
        JWindow jWindow = new JWindow(SwingUtilities.getWindowAncestor(jComponent));
        JLabel jLabel = new JLabel();
        jWindow.add(jLabel);
        AtomicInteger atomicInteger = new AtomicInteger();
        Runnable runnable = () -> {
            Point point = jComponent.getLocationOnScreen();
            float f2 = (float)atomicInteger.get() * 1.0f / 20.0f;
            int n2 = (int)a.a.a.a.d.a.a(30.0, f2);
            jWindow.setLocation(point.x + jComponent.getWidth() + n2, point.y);
        };
        Timer timer = new Timer(16, actionEvent -> {
            if (atomicInteger.incrementAndGet() < 20) {
                runnable.run();
            } else {
                ((Timer)actionEvent.getSource()).stop();
                jWindow.setVisible(false);
            }
        });
        return string -> SwingUtilities.invokeLater(() -> {
            jLabel.setText(StringUtils.defaultString((String)string));
            jWindow.pack();
            atomicInteger.set(0);
            runnable.run();
            jWindow.setVisible(true);
            timer.start();
        });
    }

    public static void a(JPanel jPanel, List<JComponent> list, a a2) {
        Validate.notNull((Object)jPanel);
        Validate.notNull(list);
        Validate.notNull((Object)((Object)a2));
        JPanel jPanel2 = new JPanel();
        jPanel2.setBorder(new EmptyBorder(10, 10, 10, 10));
        jPanel2.setLayout(new BoxLayout(jPanel2, 0));
        jPanel2.setAlignmentX(0.0f);
        if (a2 != a.a.a.a.d.a$a.START) {
            jPanel2.add(Box.createHorizontalGlue());
        }
        for (JComponent jComponent : list) {
            Validate.notNull((Object)jComponent);
            jPanel2.add(Box.createHorizontalStrut(10));
            jPanel2.add(jComponent);
            jPanel2.add(Box.createHorizontalStrut(10));
        }
        if (a2 != a.a.a.a.d.a$a.END) {
            jPanel2.add(Box.createHorizontalGlue());
        }
        jPanel.add(jPanel2);
    }

    public static void a(JComponent jComponent, String string, String string2) {
        Validate.notNull((Object)jComponent);
        if (StringUtils.isNotEmpty((CharSequence)string) || StringUtils.isNotEmpty((CharSequence)string2)) {
            SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(jComponent, string2, string, 1));
        }
    }

    private a() {
        throw new InstantiationError();
    }

    public static enum a {
        START,
        END,
        CENTER;

    }
}

