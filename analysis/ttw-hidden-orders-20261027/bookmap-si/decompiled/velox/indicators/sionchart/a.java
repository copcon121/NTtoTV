/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart;

import javax.swing.JButton;
import javax.swing.SwingUtilities;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.TelegramSettingsExtended;
import velox.indicators.sionchart.a.h;
import velox.indicators.sionchart.d;

public class a {
    JButton a = new JButton("Restore defaults");

    public a(SitIndicator sitIndicator) {
        this.a.addActionListener(actionEvent -> {
            d d2 = sitIndicator.c();
            TelegramSettingsExtended telegramSettingsExtended = d2.telegramSettings;
            telegramSettingsExtended.b(false);
            telegramSettingsExtended.a(false);
            d d3 = new d();
            d3.telegramSettings = telegramSettingsExtended;
            h.a(d3, sitIndicator.h);
            sitIndicator.d();
            SwingUtilities.invokeLater(() -> {
                sitIndicator.m.b();
                sitIndicator.n.b();
                sitIndicator.j.d.c(false);
                sitIndicator.j.e.c(true);
            });
        });
    }

    private void a(d d2, d d3) {
        h.a(d3, d2);
    }
}

