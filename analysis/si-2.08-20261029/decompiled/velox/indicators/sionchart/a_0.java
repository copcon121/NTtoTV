/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.StrategyPanel
 */
package velox.indicators.sionchart;

import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.event.ActionEvent;
import java.io.Serializable;
import javax.swing.AbstractButton;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JSeparator;
import javax.swing.JSlider;
import javax.swing.JSpinner;
import javax.swing.JTextField;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.DocumentListener;
import velox.gui.StrategyPanel;
import velox.indicators.sionchart.TelegramSettingsExtended;
import velox.indicators.sionchart.b.j;
import velox.indicators.sionchart.b.k;
import velox.indicators.sionchart.b.t;
import velox.indicators.sionchart.b_0;
import velox.indicators.sionchart.c_0;
import velox.indicators.sionchart.d_0;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.m;
import velox.indicators.sionchart.w;

/*
 * Renamed from velox.indicators.sionchart.A
 */
public class a_0
extends StrategyPanel {
    final m a;
    JLabel b;
    JTextField c;
    JButton d;
    JButton e;
    JButton f;
    JCheckBox g;
    JCheckBox h;
    JCheckBox i;
    JSpinner j;
    JCheckBox k;
    JSpinner l;
    JLabel m;
    JPanel n;
    JSlider o;
    JCheckBox p;
    Runnable q;
    DocumentListener r;

    public a_0(m m2, boolean bl) {
        super((bl ? "Stops" : "Icebergs") + " alerts settings");
        this.a = m2;
        this.a(bl);
        this.b(bl);
        this.c(bl);
    }

    public void a(boolean bl) {
        e e2 = this.a.c();
        boolean bl2 = bl ? e2.stopsPopupEnabled : e2.icebergsPopupEnabled;
        this.b = new JLabel("");
        this.c = new JTextField(bl ? e2.stopsAlertTemplate : e2.icebergsAlertTemplate);
        this.q = () -> {
            if (bl) {
                e2.stopsAlertTemplate = this.c.getText();
            } else {
                e2.icebergsAlertTemplate = this.c.getText();
            }
            this.a.d();
            String string = w.a(e2, this.a.h, 50.0, 100, 0, 1.0, true, bl);
            this.b.setText("Example: " + string);
            this.b.setToolTipText("Example: " + string);
        };
        this.c.getDocument().removeDocumentListener(this.r);
        this.r = new b_0(this);
        this.c.getDocument().addDocumentListener(this.r);
        this.c.addKeyListener(new c_0(this));
        this.q.run();
        this.c.setName(this.a.e() + ";" + (bl ? "stops" : "icebergs") + "VoiceMessageTemplateField");
        this.d = new JButton("RESET");
        this.d.addActionListener(actionEvent -> {
            if (bl) {
                e2.stopsAlertTemplate = "Stop $INSTR $SIDE at $PRICE volume $VOLUME";
                this.c.setText(e2.stopsAlertTemplate);
            } else {
                e2.icebergsAlertTemplate = "Iceberg $INSTR $SIDE at $PRICE crossed $THRESHOLD";
                this.c.setText(e2.icebergsAlertTemplate);
            }
            this.q.run();
        });
        this.d.setName(this.a.e() + ";" + (bl ? "stops" : "icebergs") + "AlertTemplateResetButton");
        this.e = new j("?", "<html>Voice message templates:<br>$INSTRUMENT - full instrument name<br>$INSTR - instrument name without @exchange part<br>$SIDE - buy or sell<br>$PRICE - price<br>$VOLUME - current traded volume<br>$THRESHOLD - volume threshold<br></html>");
        this.e.setName(this.a.e() + ";" + (bl ? "stops" : "icebergs") + "AlertTemplateInfoButton");
        this.f = new JButton("Test alert");
        this.f.addActionListener(actionEvent -> {
            String string = this.b.getText();
            d_0 d_02 = new d_0(this, "Send sound alert", string, bl2);
            w.c.submit(d_02);
        });
        this.f.setName(this.a.e() + ";" + (bl ? "stops" : "icebergs") + "TestVoiceAlertButton");
        this.g = new JCheckBox("Sound");
        if (bl) {
            this.g.setSelected(e2.stopsAlertEnabled);
            this.g.addActionListener(actionEvent -> {
                e2.stopsAlertEnabled = this.g.isSelected();
                this.a.d();
                if (e2.stopsAlertAutoThreshold) {
                    this.a.a(true);
                }
                if (this.g.isSelected()) {
                    JOptionPane.showMessageDialog(null, "Please, note, that alert threshold is applied to individual stops chains, while on the chart the values could be aggregated.", "Information", 1);
                }
            });
        } else {
            this.g.setSelected(e2.icebergsAlertEnabled);
            this.g.addActionListener(actionEvent -> {
                e2.icebergsAlertEnabled = this.g.isSelected();
                this.a.d();
                if (e2.icebergsAlertAutoThreshold) {
                    this.a.b(true);
                }
                if (this.g.isSelected()) {
                    JOptionPane.showMessageDialog(null, "Please, note, that alert threshold is applied to individual iceberg orders, while on the chart the values could be aggregated.", "Information", 1);
                }
            });
        }
        this.g.setName(this.a.e() + ";" + (bl ? "stops" : "icebergs") + "AlertEnabled");
        this.h = new JCheckBox("Pop-up");
        if (bl) {
            this.h.setSelected(e2.stopsPopupEnabled);
            this.h.addActionListener(actionEvent -> {
                e2.stopsPopupEnabled = this.h.isSelected();
                this.a.d();
                if (e2.stopsAlertAutoThreshold) {
                    this.a.a(true);
                }
            });
        } else {
            this.h.setSelected(e2.icebergsPopupEnabled);
            this.h.addActionListener(actionEvent -> {
                e2.icebergsPopupEnabled = this.h.isSelected();
                this.a.d();
                if (e2.icebergsAlertAutoThreshold) {
                    this.a.b(true);
                }
            });
        }
        this.h.setName(this.a.e() + ";" + (bl ? "stops" : "icebergs") + "popupEnabled");
        TelegramSettingsExtended telegramSettingsExtended = e2.telegramSettings;
        this.i = new JCheckBox("Telegram");
        this.i.setSelected(bl ? telegramSettingsExtended.b() : telegramSettingsExtended.a());
        this.i.addActionListener(actionEvent -> {
            if (this.i.isSelected() && (telegramSettingsExtended.getToken() == null || telegramSettingsExtended.getChatId() == null || telegramSettingsExtended.getToken().isEmpty() || telegramSettingsExtended.getChatId().isEmpty())) {
                JOptionPane.showMessageDialog(null, "Please, fill Telegram credentials first.", "Information", 1);
                this.i.setSelected(false);
                return;
            }
            if (bl) {
                telegramSettingsExtended.b(this.i.isSelected());
            } else {
                telegramSettingsExtended.a(this.i.isSelected());
            }
            this.a.d();
        });
        this.i.setName(this.a.e() + ";" + (bl ? "stops" : "icebergs") + "TelegramAlertEnabled");
        this.j = new JSpinner();
        this.j.setModel(new SpinnerNumberModel(0, 0, Integer.MAX_VALUE, 1));
        this.j.setValue(bl ? e2.stopsAlertThreshold : e2.icebergsAlertThreshold);
        t.a(this.j);
        this.j.addChangeListener(changeEvent -> {
            if (bl) {
                e2.stopsAlertThreshold = (Integer)this.j.getValue();
            } else {
                e2.icebergsAlertThreshold = (Integer)this.j.getValue();
            }
            this.a.d();
        });
        this.j.setPreferredSize(new Dimension(140, 28));
        this.j.setName(this.a.e() + ";" + (bl ? "stops" : "icebergs") + "AlertThresholdSize");
        this.k = new JCheckBox("Show only stop runs");
        this.k.setSelected(e2.showOnlyStopsTBPLAlerts);
        this.k.addActionListener(actionEvent -> {
            e2.showOnlyStopsTBPLAlerts = this.k.isSelected();
            this.a.d();
        });
        this.k.setName(this.a.e() + ";showOnlyStopsThatBrakePriceLevelAlerts");
        SpinnerNumberModel spinnerNumberModel = new SpinnerNumberModel(bl ? e2.stopsAlertSdInterval : e2.icebergsAlertSdInterval, 1, 1440, 1);
        this.l = new JSpinner(spinnerNumberModel);
        this.l.setToolTipText("Values range: " + spinnerNumberModel.getMinimum() + ".." + spinnerNumberModel.getMaximum());
        t.a(this.l);
        this.l.addChangeListener(changeEvent -> {
            if (bl) {
                e2.stopsAlertSdInterval = (Integer)this.l.getValue();
                if (e2.stopsAlertAutoThreshold) {
                    this.a.a(true);
                }
            } else {
                e2.icebergsAlertSdInterval = (Integer)this.l.getValue();
                if (e2.icebergsAlertAutoThreshold) {
                    this.a.b(true);
                }
            }
            this.a.d();
        });
        this.l.setEnabled(bl ? e2.stopsAlertAutoThreshold : e2.icebergsAlertAutoThreshold);
        this.l.setName(this.a.e() + ";" + (bl ? "stops" : "icebergs") + "AlertSdInterval");
        this.n = new JPanel();
        this.o = new JSlider(0, 0, 100, 0);
        this.n.setLayout(new BoxLayout(this.n, 1));
        this.m = new JLabel();
        this.n.add(this.m);
        this.n.add(this.o);
        this.a(bl ? e2.stopsAlertSdMultiplier : e2.icebergsAlertSdMultiplier, this.o);
        this.m.setText(Double.toString(this.a(this.o)));
        this.m.setAlignmentX(0.5f);
        this.o.addChangeListener(changeEvent -> {
            this.m.setText(Double.toString(this.a(this.o)));
            if (bl) {
                e2.stopsAlertSdMultiplier = this.a(this.o);
                if (e2.stopsAlertAutoThreshold) {
                    this.a.a(true);
                }
            } else {
                e2.icebergsAlertSdMultiplier = this.a(this.o);
                if (e2.icebergsAlertAutoThreshold) {
                    this.a.b(true);
                }
            }
            this.a.d();
        });
        this.o.setName(this.a.e() + ";" + (bl ? "stops" : "icebergs") + "SdMultiplier");
        this.p = new JCheckBox("Automatic size threshold");
        this.p.setSelected(bl ? e2.stopsAlertAutoThreshold : e2.icebergsAlertAutoThreshold);
        this.p.addActionListener(actionEvent -> {
            this.j.setEnabled(!this.p.isSelected());
            this.l.setEnabled(this.p.isSelected());
            this.o.setEnabled(this.p.isSelected());
            this.m.setEnabled(this.p.isSelected());
            if (bl) {
                e2.stopsAlertAutoThreshold = this.p.isSelected();
                if (this.p.isSelected()) {
                    this.a.a(true);
                }
            } else {
                e2.icebergsAlertAutoThreshold = this.p.isSelected();
                if (this.p.isSelected()) {
                    this.a.b(true);
                }
            }
            this.a.d();
        });
        this.j.setEnabled(!this.p.isSelected());
        this.l.setEnabled(this.p.isSelected());
        this.o.setEnabled(this.p.isSelected());
        this.m.setEnabled(this.p.isSelected());
        this.p.setName(this.a.e() + ";" + (bl ? "stops" : "icebergs") + "AlertsAutoThreshold");
    }

    public void b(boolean bl) {
        JPanel jPanel = new JPanel();
        jPanel.setLayout(new GridBagLayout());
        jPanel.setVisible(false);
        Serializable serializable = new GridBagConstraints();
        ((GridBagConstraints)serializable).fill = 2;
        ((GridBagConstraints)serializable).weightx = 0.0;
        ((GridBagConstraints)serializable).anchor = 13;
        ((GridBagConstraints)serializable).insets = new Insets(5, 5, 5, 5);
        ((GridBagConstraints)serializable).gridx = 0;
        ((GridBagConstraints)serializable).gridy = 0;
        ++((GridBagConstraints)serializable).gridy;
        ((GridBagConstraints)serializable).gridwidth = 0;
        jPanel.add((Component)new JSeparator(0), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new k(this.p, "Sets automatic size threshold based on the current settings"), serializable);
        ((GridBagConstraints)serializable).gridwidth = -1;
        ++((GridBagConstraints)serializable).gridy;
        Serializable serializable2 = new JLabel("SD interval, minutes");
        ((JComponent)serializable2).setToolTipText("Sets the time interval (moving window) to calculate the standard deviation on");
        jPanel.add((Component)serializable2, serializable);
        ++((GridBagConstraints)serializable).gridy;
        JComponent jComponent = new JLabel("SD multiplier");
        jComponent.setToolTipText("Sets the standard deviation multiplier. The higher the value is - the higher is the threshold");
        jPanel.add((Component)jComponent, serializable);
        ++((GridBagConstraints)serializable).gridy;
        ((GridBagConstraints)serializable).gridwidth = 0;
        jPanel.add((Component)new JSeparator(0), serializable);
        ((GridBagConstraints)serializable).gridwidth = -1;
        ((GridBagConstraints)serializable).gridx = 1;
        ((GridBagConstraints)serializable).gridy = 3;
        ((GridBagConstraints)serializable).weightx = 1.0;
        jPanel.add((Component)new k(this.l, "Sets the time interval (moving window) to calculate the standard deviation on"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new k(this.n, "Sets the standard deviation multiplier. The higher the value is - the higher is the threshold"), serializable);
        serializable = new JPanel();
        ((Container)serializable).setLayout(new GridBagLayout());
        ((JComponent)serializable).setVisible(false);
        serializable2 = new GridBagConstraints();
        ((GridBagConstraints)serializable2).fill = 2;
        ((GridBagConstraints)serializable2).weightx = 1.0;
        ((GridBagConstraints)serializable2).anchor = 13;
        ((GridBagConstraints)serializable2).insets = new Insets(5, 5, 5, 5);
        ((GridBagConstraints)serializable2).gridx = 0;
        ((GridBagConstraints)serializable2).gridy = 0;
        if (bl) {
            ((GridBagConstraints)serializable2).gridwidth = 0;
            ((Container)serializable).add(new k(this.k, "Show only stop chains executed on multiple price levels"), serializable2);
            ++((GridBagConstraints)serializable2).gridy;
        }
        ((GridBagConstraints)serializable2).gridx = 0;
        ((GridBagConstraints)serializable2).gridy += 2;
        ((GridBagConstraints)serializable2).gridwidth = 2;
        ((Container)serializable).add(this.c, serializable2);
        ((GridBagConstraints)serializable2).weightx = 0.0;
        ++((GridBagConstraints)serializable2).gridy;
        ((GridBagConstraints)serializable2).gridwidth = 3;
        ((Container)serializable).add(this.b, serializable2);
        ((GridBagConstraints)serializable2).gridx += 3;
        ((GridBagConstraints)serializable2).gridwidth = 1;
        ((Container)serializable).add(this.f, serializable2);
        --((GridBagConstraints)serializable2).gridy;
        ((Container)serializable).add(this.d, serializable2);
        --((GridBagConstraints)serializable2).gridx;
        ((Container)serializable).add(this.e, serializable2);
        serializable2 = new JPanel();
        ((Container)serializable2).setLayout(new GridBagLayout());
        jComponent = new JButton();
        ((AbstractButton)jComponent).setIcon(velox.indicators.sionchart.m.s);
        jComponent.setPreferredSize(new Dimension(22, 22));
        jComponent.setMaximumSize(new Dimension(22, 22));
        ((AbstractButton)jComponent).addActionListener(arg_0 -> a_0.a((JPanel)serializable, jPanel, (JButton)jComponent, arg_0));
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        gridBagConstraints.insets = new Insets(4, 2, 4, 2);
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 0;
        gridBagConstraints.weightx = 0.0;
        gridBagConstraints.anchor = 21;
        ((Container)serializable2).add(jComponent, gridBagConstraints);
        gridBagConstraints.weightx = 1.0;
        ++gridBagConstraints.gridx;
        ((Container)serializable2).add(this.g, gridBagConstraints);
        ++gridBagConstraints.gridx;
        ((Container)serializable2).add(this.h, gridBagConstraints);
        ++gridBagConstraints.gridx;
        gridBagConstraints.anchor = 10;
        ((Container)serializable2).add(this.i, gridBagConstraints);
        gridBagConstraints.gridx = 1;
        ++gridBagConstraints.gridy;
        gridBagConstraints.anchor = 21;
        ((Container)serializable2).add(new JLabel("Alert threshold (>=)"), gridBagConstraints);
        ++gridBagConstraints.gridx;
        gridBagConstraints.gridwidth = 0;
        gridBagConstraints.fill = 2;
        ((Container)serializable2).add(this.j, gridBagConstraints);
        this.setLayout(new BoxLayout((Container)((Object)this), 1));
        this.add((Component)serializable2);
        this.add(jPanel);
        this.add((Component)serializable);
    }

    public void c(boolean bl) {
        e e2 = this.a.c();
        this.c.setText(bl ? e2.stopsAlertTemplate : e2.icebergsAlertTemplate);
        this.q.run();
        this.g.setSelected(bl ? e2.stopsAlertEnabled : e2.icebergsAlertEnabled);
        this.h.setSelected(bl ? e2.stopsPopupEnabled : e2.icebergsPopupEnabled);
        if (bl && e2.stopsAlertAutoThreshold) {
            this.a.a(true);
        } else if (!bl && e2.icebergsAlertAutoThreshold) {
            this.a.b(true);
        }
        TelegramSettingsExtended telegramSettingsExtended = e2.telegramSettings;
        this.i.setSelected(bl ? telegramSettingsExtended.b() : telegramSettingsExtended.a());
        this.j.setValue(bl ? e2.stopsAlertThreshold : e2.icebergsAlertThreshold);
        this.k.setSelected(e2.showOnlyStopsTBPLAlerts);
        this.l.setValue(bl ? e2.stopsAlertSdInterval : e2.icebergsAlertSdInterval);
        this.l.setEnabled(bl ? e2.stopsAlertAutoThreshold : e2.icebergsAlertAutoThreshold);
        this.a(bl ? e2.stopsAlertSdMultiplier : e2.icebergsAlertSdMultiplier, this.o);
        this.m.setText(Double.toString(this.a(this.o)));
        this.p.setSelected(bl ? e2.stopsAlertAutoThreshold : e2.icebergsAlertAutoThreshold);
        this.j.setEnabled(!this.p.isSelected());
        this.l.setEnabled(this.p.isSelected());
        this.o.setEnabled(this.p.isSelected());
        this.m.setEnabled(this.p.isSelected());
    }

    private double a(JSlider jSlider) {
        return (double)jSlider.getValue() / 10.0;
    }

    void a(double d2, JSlider jSlider) {
        jSlider.setValue((int)(d2 * 10.0));
    }

    private static /* synthetic */ void a(JPanel jPanel, JPanel jPanel2, JButton jButton, ActionEvent actionEvent) {
        boolean bl = !jPanel.isVisible();
        jPanel.setVisible(bl);
        jPanel2.setVisible(bl);
        if (bl) {
            jButton.setIcon(velox.indicators.sionchart.m.t);
        } else {
            jButton.setIcon(velox.indicators.sionchart.m.s);
        }
    }
}

