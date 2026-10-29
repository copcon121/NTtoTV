/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.common.Log
 *  velox.api.layer1.layers.utils.SoundSynthHelper
 *  velox.api.layer1.messages.Layer1ApiSoundAlertCancelMessage
 *  velox.api.layer1.messages.Layer1ApiSoundAlertCancelMessage$Layer1ApiSoundMessagesFilter
 *  velox.api.layer1.messages.Layer1ApiSoundAlertMessage
 *  velox.api.layer1.messages.Layer1ApiSoundAlertMessage$SoundAlertStatus
 *  velox.api.layer1.messages.Layer1ApiSoundAlertMessage$SoundAlertStatusListener
 */
package velox.indicators.sionchart;

import a.a.a.a.a;
import java.awt.Dialog;
import java.awt.Dimension;
import java.awt.Toolkit;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.swing.JDialog;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import velox.api.layer1.common.Log;
import velox.api.layer1.layers.utils.SoundSynthHelper;
import velox.api.layer1.messages.Layer1ApiSoundAlertCancelMessage;
import velox.api.layer1.messages.Layer1ApiSoundAlertMessage;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.a.b;
import velox.indicators.sionchart.a.t;
import velox.indicators.sionchart.a_0;
import velox.indicators.sionchart.b_0;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.y;
import velox.indicators.sionchart.z;

public class x {
    public static final String a = "Stop $INSTR $SIDE at $PRICE volume $VOLUME";
    public static final String b = "Iceberg $INSTR $SIDE at $PRICE crossed $THRESHOLD";
    private final e f;
    private final SitIndicator g;
    private static final ExecutorService h = Executors.newSingleThreadExecutor();
    private static final HashSet<b> i = new HashSet();
    static JDialog c = null;
    b_0 d;
    b_0 e;

    x(SitIndicator sitIndicator) {
        this.f = sitIndicator.e();
        this.g = sitIndicator;
        this.d = new b_0(sitIndicator, false);
        this.e = new b_0(sitIndicator, true);
    }

    static String a(e e2, String string, double d2, int n2, int n3, double d3, boolean bl, boolean bl2) {
        String string2 = bl2 ? e2.stopsAlertTemplate : e2.icebergsAlertTemplate;
        BigDecimal bigDecimal = BigDecimal.valueOf(d2).setScale(t.a(d3), 4).stripTrailingZeros();
        string2 = string2.replace("$PRICE", bigDecimal.toPlainString());
        string2 = string2.replace("$VOLUME", Integer.toString(n2));
        string2 = string2.replace("$THRESHOLD", Integer.toString(n3));
        string2 = string2.replace("$SIDE", bl ? "buy" : "sell");
        if (string != null) {
            int n4 = string.indexOf(64);
            string2 = string2.replace("$INSTR", n4 > 0 ? string.substring(0, n4) : string);
            string2 = string2.replace("$INSTRUMENT", string);
        }
        return string2;
    }

    void a(double d2, int n2, boolean bl, boolean bl2) {
        b b2;
        int n3 = bl2 ? this.f.stopsAlertThreshold : this.f.icebergsAlertThreshold;
        String string = x.a(this.f, this.g.j, d2 * this.g.l, n2, n3, this.g.l, bl, bl2);
        byte[] byArray = SoundSynthHelper.synthesize((String)string);
        b b3 = new b();
        int n4 = 0;
        Iterator<b> iterator = i.iterator();
        while (iterator.hasNext()) {
            b2 = iterator.next();
            if (b2.a == Layer1ApiSoundAlertMessage.SoundAlertStatus.DONE) {
                iterator.remove();
                continue;
            }
            if (b2.a != Layer1ApiSoundAlertMessage.SoundAlertStatus.PENDING && b2.a != Layer1ApiSoundAlertMessage.SoundAlertStatus.PLAYING && b2.a != null) continue;
            ++n4;
        }
        if (n4 >= 5) {
            this.a(false);
            if (c == null) {
                SwingUtilities.invokeLater(() -> {
                    if (this.g.m) {
                        JOptionPane jOptionPane = new JOptionPane("<html>Stops&Icebergs On-Chart sound alerts queue<br>grew too long, some alerts were skipped.</html>", 1);
                        JDialog jDialog = new JDialog((Dialog)null, "Information");
                        jDialog.setSize(450, 150);
                        Dimension dimension = Toolkit.getDefaultToolkit().getScreenSize();
                        jDialog.setLocation(dimension.width / 2 - jDialog.getSize().width / 2, dimension.height / 2 - jDialog.getSize().height / 2);
                        jDialog.setDefaultCloseOperation(2);
                        jDialog.setContentPane(jOptionPane);
                        jDialog.addWindowListener(new y(this));
                        jDialog.setVisible(true);
                        c = jDialog;
                        jOptionPane.addPropertyChangeListener(propertyChangeEvent -> {
                            if (jDialog.isVisible() && propertyChangeEvent.getSource() == jOptionPane) {
                                jDialog.dispose();
                                c = null;
                            }
                        });
                    }
                });
            }
        }
        i.add(b3);
        if (this.g.m) {
            b2 = new Layer1ApiSoundAlertMessage(byArray, string, 1L, null, (Layer1ApiSoundAlertMessage.SoundAlertStatusListener)b3, this.g.getClass(), (Object)this.g.j);
            this.g.h.sendUserMessage((Object)b2);
            if (bl2 && this.g.w.b() || !bl2 && this.g.w.a()) {
                a.a.a.a.a.a(this.g.v, this.g.w, string, this.g.x, a.a.a.a.b.a(Log::debug));
            }
        }
    }

    void b(double d2, int n2, boolean bl, boolean bl2) {
        if (this.g.m) {
            z z2 = new z(this, "Send sound alert", d2, n2, bl, bl2);
            h.submit(z2);
        }
    }

    void a(boolean bl) {
        a_0 a_02 = new a_0(this, bl);
        Layer1ApiSoundAlertCancelMessage layer1ApiSoundAlertCancelMessage = new Layer1ApiSoundAlertCancelMessage(this.g.getClass(), (Layer1ApiSoundAlertCancelMessage.Layer1ApiSoundMessagesFilter)a_02);
        this.g.h.sendUserMessage((Object)layer1ApiSoundAlertCancelMessage);
    }
}

