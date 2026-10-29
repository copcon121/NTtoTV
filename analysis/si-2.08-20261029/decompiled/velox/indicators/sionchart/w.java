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

import com.bookmap.addons.common.h.a;
import java.awt.Dialog;
import java.awt.Dimension;
import java.awt.Toolkit;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.swing.JDialog;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import velox.api.layer1.common.Log;
import velox.api.layer1.layers.utils.SoundSynthHelper;
import velox.api.layer1.messages.Layer1ApiSoundAlertCancelMessage;
import velox.api.layer1.messages.Layer1ApiSoundAlertMessage;
import velox.indicators.sionchart.a_0;
import velox.indicators.sionchart.b.b;
import velox.indicators.sionchart.b.t;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.m;
import velox.indicators.sionchart.x;
import velox.indicators.sionchart.y;
import velox.indicators.sionchart.z;

public class w {
    public static final String a = "Stop $INSTR $SIDE at $PRICE volume $VOLUME";
    public static final String b = "Iceberg $INSTR $SIDE at $PRICE crossed $THRESHOLD";
    private final e g;
    private final m h;
    public static final ExecutorService c = Executors.newSingleThreadExecutor();
    private final HashMap<String, b> i = new HashMap();
    static JDialog d = null;
    public a_0 e;
    public a_0 f;

    w(m m2) {
        this.g = m2.c();
        this.h = m2;
        this.e = new a_0(m2, false);
        this.f = new a_0(m2, true);
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

    private void b(double d2, int n2, boolean bl, boolean bl2) {
        int n3 = bl2 ? this.g.stopsAlertThreshold : this.g.icebergsAlertThreshold;
        boolean bl3 = bl2 && this.g.stopsAlertEnabled || !bl2 && this.g.icebergsAlertEnabled;
        boolean bl4 = bl2 && this.g.stopsPopupEnabled || !bl2 && this.g.icebergsPopupEnabled;
        boolean bl5 = bl2 && this.h.v.b() || !bl2 && this.h.v.a();
        String string = "";
        if (bl3 || bl4 || bl5) {
            string = w.a(this.g, this.h.h, d2 * this.h.j, n2, n3, this.h.j, bl, bl2);
        }
        if (bl3 || bl4) {
            b b2;
            int n4 = 0;
            Iterator<Map.Entry<String, b>> iterator = this.i.entrySet().iterator();
            while (iterator.hasNext()) {
                b2 = iterator.next().getValue();
                if (b2.a == Layer1ApiSoundAlertMessage.SoundAlertStatus.DONE) {
                    iterator.remove();
                    continue;
                }
                if (b2.a != Layer1ApiSoundAlertMessage.SoundAlertStatus.PENDING && b2.a != Layer1ApiSoundAlertMessage.SoundAlertStatus.PLAYING && b2.a != null) continue;
                ++n4;
            }
            if (n4 >= 5) {
                this.a(false);
                if (d == null) {
                    SwingUtilities.invokeLater(() -> {
                        if (this.h.k) {
                            JOptionPane jOptionPane = new JOptionPane("<html>" + this.h.e() + " sound alerts queue<br>grew too long, some alerts were skipped.</html>", 1);
                            JDialog jDialog = new JDialog((Dialog)null, "Information");
                            jDialog.setSize(450, 150);
                            Dimension dimension = Toolkit.getDefaultToolkit().getScreenSize();
                            jDialog.setLocation(dimension.width / 2 - jDialog.getSize().width / 2, dimension.height / 2 - jDialog.getSize().height / 2);
                            jDialog.setDefaultCloseOperation(2);
                            jDialog.setContentPane(jOptionPane);
                            jDialog.addWindowListener(new x(this));
                            jDialog.setVisible(true);
                            d = jDialog;
                            jOptionPane.addPropertyChangeListener(propertyChangeEvent -> {
                                if (jDialog.isVisible() && propertyChangeEvent.getSource() == jOptionPane) {
                                    jDialog.dispose();
                                    d = null;
                                }
                            });
                        }
                    });
                }
            }
            b2 = new b();
            Layer1ApiSoundAlertMessage layer1ApiSoundAlertMessage = null;
            if (bl3) {
                byte[] byArray = SoundSynthHelper.synthesize((String)string);
                if (this.h.k) {
                    layer1ApiSoundAlertMessage = Layer1ApiSoundAlertMessage.builder().setSound(byArray).setTextInfo(string).setShowPopup(bl4).setStatusListener((Layer1ApiSoundAlertMessage.SoundAlertStatusListener)b2).setSource(this.h.getClass()).setAlias(this.h.h).build();
                }
            } else {
                layer1ApiSoundAlertMessage = Layer1ApiSoundAlertMessage.builder().setTextInfo(string).setShowPopup(bl4).setStatusListener((Layer1ApiSoundAlertMessage.SoundAlertStatusListener)b2).setSource(this.h.getClass()).setAlias(this.h.h).build();
            }
            if (this.h.k) {
                this.i.put(layer1ApiSoundAlertMessage.alertId, b2);
                this.h.f.sendUserMessage((Object)layer1ApiSoundAlertMessage);
            }
        }
        if (this.h.k && bl5) {
            com.bookmap.addons.common.h.a.a(this.h.u, this.h.v, string, this.h.w, com.bookmap.addons.common.h.b.a(Log::debug));
        }
    }

    void a(double d2, int n2, boolean bl, boolean bl2) {
        if (this.h.k) {
            y y2 = new y(this, "Send sound/telegram alert", d2, n2, bl, bl2);
            c.submit(y2);
        }
    }

    void a(boolean bl) {
        z z2 = new z(this, bl);
        Layer1ApiSoundAlertCancelMessage layer1ApiSoundAlertCancelMessage = new Layer1ApiSoundAlertCancelMessage(this.h.getClass(), (Layer1ApiSoundAlertCancelMessage.Layer1ApiSoundMessagesFilter)z2);
        this.h.f.sendUserMessage((Object)layer1ApiSoundAlertCancelMessage);
    }
}

