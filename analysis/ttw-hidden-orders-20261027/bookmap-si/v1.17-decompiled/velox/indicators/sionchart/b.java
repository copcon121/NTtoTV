/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart;

import javax.swing.JButton;
import javax.swing.SwingUtilities;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.TelegramSettingsExtended;
import velox.indicators.sionchart.a.h;
import velox.indicators.sionchart.e;

public class b {
    JButton a = new JButton("Restore defaults");

    public b(SitIndicator sitIndicator) {
        this.a.addActionListener(actionEvent -> {
            e e2 = sitIndicator.e();
            TelegramSettingsExtended telegramSettingsExtended = e2.telegramSettings;
            telegramSettingsExtended.b(false);
            telegramSettingsExtended.a(false);
            e e3 = new e();
            e3.telegramSettings = telegramSettingsExtended;
            h.a(e3, sitIndicator.i);
            sitIndicator.f();
            SwingUtilities.invokeLater(() -> {
                sitIndicator.n.b();
                sitIndicator.o.b();
                sitIndicator.k.d.c(false);
                sitIndicator.k.e.c(true);
                sitIndicator.p.a();
                sitIndicator.q.a();
            });
        });
    }

    private void a(e e2, e e3) {
        h.a(e3, e2);
    }
}

