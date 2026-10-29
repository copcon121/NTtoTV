/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.a;

import javax.swing.JButton;
import javax.swing.SwingUtilities;
import velox.indicators.sionchart.TelegramSettingsExtended;
import velox.indicators.sionchart.b.h;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.m;

public class b {
    JButton a = new JButton("Restore defaults");

    public b(m m2, boolean bl) {
        this.a.addActionListener(actionEvent -> {
            e e2 = m2.c();
            TelegramSettingsExtended telegramSettingsExtended = e2.telegramSettings;
            telegramSettingsExtended.b(false);
            telegramSettingsExtended.a(false);
            e e3 = new e();
            if (!bl) {
                e3.showStops = false;
            }
            e3.telegramSettings = telegramSettingsExtended;
            h.a(e3, m2.c());
            m2.d();
            SwingUtilities.invokeLater(() -> {
                m2.l.b();
                m2.m.b();
                m2.i.e.c(false);
                m2.i.f.c(true);
                m2.n.a();
            });
        });
    }

    private void a(e e2, e e3) {
        h.a(e3, e2);
    }
}

