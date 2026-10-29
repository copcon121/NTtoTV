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
import velox.indicators.sionchart.d;
import velox.indicators.sionchart.v;
import velox.indicators.sionchart.w;
import velox.indicators.sionchart.x;
import velox.indicators.sionchart.y;

public class u {
    public static final String a = "Stop $INSTR $SIDE at $PRICE volume $VOLUME";
    public static final String b = "Iceberg $INSTR $SIDE at $PRICE crossed $THRESHOLD";
    private final d f;
    private final SitIndicator g;
    private static final ExecutorService h = Executors.newSingleThreadExecutor();
    private static final HashSet<b> i = new HashSet();
    static JDialog c = null;
    y d;
    y e;

    u(SitIndicator sitIndicator) {
        this.f = sitIndicator.c();
        this.g = sitIndicator;
        this.d = new y(sitIndicator, false);
        this.e = new y(sitIndicator, true);
    }

    static String a(d d2, String string, double d3, int n2, int n3, double d4, boolean bl, boolean bl2) {
        String string2 = bl2 ? d2.stopsAlertTemplate : d2.icebergsAlertTemplate;
        BigDecimal bigDecimal = BigDecimal.valueOf(d3).setScale(t.a(d4), 4).stripTrailingZeros();
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
        String string = u.a(this.f, this.g.i, d2 * this.g.k, n2, n3, this.g.k, bl, bl2);
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
                    if (this.g.l) {
                        JOptionPane jOptionPane = new JOptionPane("<html>Stops&Icebergs On-Chart sound alerts queue<br>grew too long, some alerts were skipped.</html>", 1);
                        JDialog jDialog = new JDialog((Dialog)null, "Information");
                        jDialog.setSize(450, 150);
                        Dimension dimension = Toolkit.getDefaultToolkit().getScreenSize();
                        jDialog.setLocation(dimension.width / 2 - jDialog.getSize().width / 2, dimension.height / 2 - jDialog.getSize().height / 2);
                        jDialog.setDefaultCloseOperation(2);
                        jDialog.setContentPane(jOptionPane);
                        jDialog.addWindowListener(new v(this));
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
        if (this.g.l) {
            b2 = new Layer1ApiSoundAlertMessage(byArray, string, 1L, null, (Layer1ApiSoundAlertMessage.SoundAlertStatusListener)b3, this.g.getClass(), (Object)this.g.i);
            this.g.g.sendUserMessage((Object)b2);
            if (bl2 && this.g.t.b() || !bl2 && this.g.t.a()) {
                a.a.a.a.a.a(this.g.s, this.g.t, string, this.g.u, a.a.a.a.b.a(Log::debug));
            }
        }
    }

    void b(double d2, int n2, boolean bl, boolean bl2) {
        if (this.g.l) {
            w w2 = new w(this, "Send sound alert", d2, n2, bl, bl2);
            h.submit(w2);
        }
    }

    void a(boolean bl) {
        x x2 = new x(this, bl);
        Layer1ApiSoundAlertCancelMessage layer1ApiSoundAlertCancelMessage = new Layer1ApiSoundAlertCancelMessage(this.g.getClass(), (Layer1ApiSoundAlertCancelMessage.Layer1ApiSoundMessagesFilter)x2);
        this.g.g.sendUserMessage((Object)layer1ApiSoundAlertCancelMessage);
    }

    static /* synthetic */ SitIndicator a(u u2) {
        return u2.g;
    }
}

