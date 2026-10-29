/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.utils.SoundSynthHelper
 *  velox.api.layer1.messages.Layer1ApiSoundAlertMessage
 *  velox.api.layer1.messages.Layer1ApiSoundAlertMessage$SoundAlertStatusListener
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
import velox.api.layer1.layers.utils.SoundSynthHelper;
import velox.api.layer1.messages.Layer1ApiSoundAlertMessage;
import velox.gui.StrategyPanel;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.TelegramSettingsExtended;
import velox.indicators.sionchart.a.b;
import velox.indicators.sionchart.a.j;
import velox.indicators.sionchart.a.k;
import velox.indicators.sionchart.a.t;
import velox.indicators.sionchart.a_0;
import velox.indicators.sionchart.d;
import velox.indicators.sionchart.u;
import velox.indicators.sionchart.z;

public class y
extends StrategyPanel {
    final SitIndicator a;
    JLabel b;
    JTextField c;
    JButton d;
    JButton e;
    JButton f;
    JCheckBox g;
    JCheckBox h;
    JSpinner i;
    JCheckBox j;
    JSpinner k;
    JLabel l;
    JPanel m;
    JSlider n;
    JCheckBox o;
    Runnable p;
    DocumentListener q;

    public y(SitIndicator sitIndicator, boolean bl) {
        super((bl ? "Stops" : "Icebergs") + " alerts settings");
        this.a = sitIndicator;
        this.a(bl);
        this.b(bl);
        this.c(bl);
    }

    public void a(boolean bl) {
        d d2 = this.a.c();
        this.b = new JLabel("");
        this.c = new JTextField(bl ? d2.stopsAlertTemplate : d2.icebergsAlertTemplate);
        this.p = () -> {
            if (bl) {
                d2.stopsAlertTemplate = this.c.getText();
            } else {
                d2.icebergsAlertTemplate = this.c.getText();
            }
            this.a.d();
            String string = u.a(d2, this.a.i, 50.0, 100, 0, 1.0, true, bl);
            this.b.setText("Example: " + string);
            this.b.setToolTipText("Example: " + string);
        };
        this.c.getDocument().removeDocumentListener(this.q);
        this.q = new z(this);
        this.c.getDocument().addDocumentListener(this.q);
        this.c.addKeyListener(new a_0(this));
        this.p.run();
        this.c.setName("Stops&Icebergs On-Chart;" + (bl ? "stops" : "icebergs") + "VoiceMessageTemplateField");
        this.d = new JButton("RESET");
        this.d.addActionListener(actionEvent -> {
            if (bl) {
                d2.stopsAlertTemplate = "Stop $INSTR $SIDE at $PRICE volume $VOLUME";
                this.c.setText(d2.stopsAlertTemplate);
            } else {
                d2.icebergsAlertTemplate = "Iceberg $INSTR $SIDE at $PRICE crossed $THRESHOLD";
                this.c.setText(d2.icebergsAlertTemplate);
            }
            this.p.run();
        });
        this.d.setName("Stops&Icebergs On-Chart;" + (bl ? "stops" : "icebergs") + "AlertTemplateResetButton");
        this.e = new j("?", "<html>Voice message templates:<br>$INSTRUMENT - full instrument name<br>$INSTR - instrument name without @exchange part<br>$SIDE - buy or sell<br>$PRICE - price<br>$VOLUME - current traded volume<br>$THRESHOLD - volume threshold<br></html>");
        this.e.setName("Stops&Icebergs On-Chart;" + (bl ? "stops" : "icebergs") + "AlertTemplateInfoButton");
        this.f = new JButton("Test alert");
        this.f.addActionListener(actionEvent -> {
            String string = this.b.getText();
            byte[] byArray = SoundSynthHelper.synthesize((String)string);
            Layer1ApiSoundAlertMessage layer1ApiSoundAlertMessage = new Layer1ApiSoundAlertMessage(byArray, "Test alert(" + string + ")", 1L, null, (Layer1ApiSoundAlertMessage.SoundAlertStatusListener)new b(), this.a.getClass(), (Object)this.a.i);
            this.a.g.sendUserMessage((Object)layer1ApiSoundAlertMessage);
        });
        this.f.setName("Stops&Icebergs On-Chart;" + (bl ? "stops" : "icebergs") + "TestVoiceAlertButton");
        this.g = new JCheckBox("Enable alert   ");
        if (bl) {
            this.g.setSelected(d2.stopsAlertEnabled);
            this.g.addActionListener(actionEvent -> {
                d2.stopsAlertEnabled = this.g.isSelected();
                this.a.d();
                if (d2.stopsAlertAutoThreshold) {
                    this.a.b(true);
                }
                if (this.g.isSelected()) {
                    JOptionPane.showMessageDialog(null, "Please, note, that alert threshold is applied to individual stops chains, while on the chart the values could be aggregated.", "Information", 1);
                }
            });
        } else {
            this.g.setSelected(d2.icebergsAlertEnabled);
            this.g.addActionListener(actionEvent -> {
                d2.icebergsAlertEnabled = this.g.isSelected();
                this.a.d();
                if (d2.icebergsAlertAutoThreshold) {
                    this.a.c(true);
                }
                if (this.g.isSelected()) {
                    JOptionPane.showMessageDialog(null, "Please, note, that alert threshold is applied to individual iceberg orders, while on the chart the values could be aggregated.", "Information", 1);
                }
            });
        }
        this.g.setName("Stops&Icebergs On-Chart;" + (bl ? "stops" : "icebergs") + "AlertEnabled");
        TelegramSettingsExtended telegramSettingsExtended = d2.telegramSettings;
        this.h = new JCheckBox("Enable Telegram alert");
        this.h.setSelected(bl ? telegramSettingsExtended.b() : telegramSettingsExtended.a());
        this.h.addActionListener(actionEvent -> {
            if (this.h.isSelected() && (telegramSettingsExtended.getToken() == null || telegramSettingsExtended.getChatId() == null || telegramSettingsExtended.getToken().equals("") || telegramSettingsExtended.getChatId().equals(""))) {
                JOptionPane.showMessageDialog(null, "Please, fill Telegram credentials first.", "Information", 1);
                this.h.setSelected(false);
                return;
            }
            if (bl) {
                telegramSettingsExtended.b(this.h.isSelected());
            } else {
                telegramSettingsExtended.a(this.h.isSelected());
            }
            this.a.d();
        });
        this.h.setName("Stops&Icebergs On-Chart;" + (bl ? "stops" : "icebergs") + "telegramAlertEnabled");
        this.i = new JSpinner();
        this.i.setModel(new SpinnerNumberModel(0, 0, Integer.MAX_VALUE, 1));
        this.i.setValue(bl ? d2.stopsAlertThreshold : d2.icebergsAlertThreshold);
        t.a(this.i);
        this.i.addChangeListener(changeEvent -> {
            if (bl) {
                d2.stopsAlertThreshold = (Integer)this.i.getValue();
            } else {
                d2.icebergsAlertThreshold = (Integer)this.i.getValue();
            }
            this.a.d();
        });
        this.i.setPreferredSize(new Dimension(140, 28));
        this.i.setName("Stops&Icebergs On-Chart;" + (bl ? "stops" : "icebergs") + "AlertThresholdSize");
        this.j = new JCheckBox("Show only stop runs");
        this.j.setSelected(d2.showOnlyStopsTBPLAlerts);
        this.j.addActionListener(actionEvent -> {
            d2.showOnlyStopsTBPLAlerts = this.j.isSelected();
            this.a.d();
        });
        this.j.setName("Stops&Icebergs On-Chart;showOnlyStopsThatBrakePriceLevelAlerts");
        SpinnerNumberModel spinnerNumberModel = new SpinnerNumberModel(bl ? d2.stopsAlertSdInterval : d2.icebergsAlertSdInterval, 1, 1440, 1);
        this.k = new JSpinner(spinnerNumberModel);
        this.k.setToolTipText("Values range: " + spinnerNumberModel.getMinimum() + ".." + spinnerNumberModel.getMaximum());
        t.a(this.k);
        this.k.addChangeListener(changeEvent -> {
            if (bl) {
                d2.stopsAlertSdInterval = (Integer)this.k.getValue();
                if (d2.stopsAlertAutoThreshold) {
                    this.a.b(true);
                }
            } else {
                d2.icebergsAlertSdInterval = (Integer)this.k.getValue();
                if (d2.icebergsAlertAutoThreshold) {
                    this.a.c(true);
                }
            }
            this.a.d();
        });
        this.k.setEnabled(bl ? d2.stopsAlertAutoThreshold : d2.icebergsAlertAutoThreshold);
        this.k.setName("Stops&Icebergs On-Chart;" + (bl ? "stops" : "icebergs") + "AlertSdInterval");
        this.m = new JPanel();
        this.n = new JSlider(0, 0, 100, 0);
        this.m.setLayout(new BoxLayout(this.m, 1));
        this.l = new JLabel();
        this.m.add(this.l);
        this.m.add(this.n);
        this.a(bl ? d2.stopsAlertSdMultiplier : d2.icebergsAlertSdMultiplier, this.n);
        this.l.setText(Double.toString(this.a(this.n)));
        this.l.setAlignmentX(0.5f);
        this.n.addChangeListener(changeEvent -> {
            this.l.setText(Double.toString(this.a(this.n)));
            if (bl) {
                d2.stopsAlertSdMultiplier = this.a(this.n);
                if (d2.stopsAlertAutoThreshold) {
                    this.a.b(true);
                }
            } else {
                d2.icebergsAlertSdMultiplier = this.a(this.n);
                if (d2.icebergsAlertAutoThreshold) {
                    this.a.c(true);
                }
            }
            this.a.d();
        });
        this.n.setName("Stops&Icebergs On-Chart;" + (bl ? "stops" : "icebergs") + "SdMultiplier");
        this.o = new JCheckBox("Automatic size threshold");
        this.o.setSelected(bl ? d2.stopsAlertAutoThreshold : d2.icebergsAlertAutoThreshold);
        this.o.addActionListener(actionEvent -> {
            this.i.setEnabled(!this.o.isSelected());
            this.k.setEnabled(this.o.isSelected());
            this.n.setEnabled(this.o.isSelected());
            this.l.setEnabled(this.o.isSelected());
            if (bl) {
                d2.stopsAlertAutoThreshold = this.o.isSelected();
                if (this.o.isSelected()) {
                    this.a.b(true);
                }
            } else {
                d2.icebergsAlertAutoThreshold = this.o.isSelected();
                if (this.o.isSelected()) {
                    this.a.c(true);
                }
            }
            this.a.d();
        });
        this.i.setEnabled(!this.o.isSelected());
        this.k.setEnabled(this.o.isSelected());
        this.n.setEnabled(this.o.isSelected());
        this.l.setEnabled(this.o.isSelected());
        this.o.setName("Stops&Icebergs On-Chart;" + (bl ? "stops" : "icebergs") + "AlertsAutoThreshold");
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
        jPanel.add((Component)new k(this.o, "Sets automatic size threshold based on the current settings"), serializable);
        ((GridBagConstraints)serializable).gridwidth = -1;
        ++((GridBagConstraints)serializable).gridy;
        Serializable serializable2 = new JLabel("SD interval, minutes");
        ((JComponent)serializable2).setToolTipText("Sets the time interval (moving window) to calculate the standard deviation on");
        jPanel.add((Component)serializable2, serializable);
        ++((GridBagConstraints)serializable).gridy;
        Serializable serializable3 = new JLabel("SD multiplier");
        ((JComponent)serializable3).setToolTipText("Sets the standard deviation multiplier. The higher the value is - the higher is the threshold");
        jPanel.add((Component)serializable3, serializable);
        ++((GridBagConstraints)serializable).gridy;
        ((GridBagConstraints)serializable).gridwidth = 0;
        jPanel.add((Component)new JSeparator(0), serializable);
        ((GridBagConstraints)serializable).gridwidth = -1;
        ((GridBagConstraints)serializable).gridx = 1;
        ((GridBagConstraints)serializable).gridy = 3;
        ((GridBagConstraints)serializable).weightx = 1.0;
        jPanel.add((Component)new k(this.k, "Sets the time interval (moving window) to calculate the standard deviation on"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new k(this.m, "Sets the standard deviation multiplier. The higher the value is - the higher is the threshold"), serializable);
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
            ((Container)serializable).add(new k(this.j, "Show only stop chains executed on multiple price levels"), serializable2);
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
        ((JComponent)serializable2).setVisible(false);
        serializable3 = new GridBagConstraints();
        ((GridBagConstraints)serializable3).fill = 2;
        ((GridBagConstraints)serializable3).weightx = 1.0;
        ((GridBagConstraints)serializable3).anchor = 17;
        ((GridBagConstraints)serializable3).insets = new Insets(5, 5, 5, 5);
        ((GridBagConstraints)serializable3).gridx = 0;
        ((GridBagConstraints)serializable3).gridy = 0;
        ((GridBagConstraints)serializable3).gridwidth = 0;
        ((Container)serializable2).add(new JSeparator(0), serializable3);
        ((GridBagConstraints)serializable3).gridwidth = -1;
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new k(this.h, "In order to receive telegram notifications, you need to enable sound alerts."), serializable3);
        serializable3 = new JPanel();
        ((Container)serializable3).setLayout(new GridBagLayout());
        JButton jButton = new JButton();
        jButton.setIcon(SitIndicator.q);
        jButton.setPreferredSize(new Dimension(22, 22));
        jButton.setMaximumSize(new Dimension(22, 22));
        jButton.addActionListener(arg_0 -> y.a((JPanel)serializable, jPanel, (JPanel)serializable2, jButton, arg_0));
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        gridBagConstraints.insets = new Insets(4, 2, 4, 2);
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 0;
        gridBagConstraints.weightx = 0.0;
        gridBagConstraints.anchor = 21;
        ((Container)serializable3).add(jButton, gridBagConstraints);
        gridBagConstraints.weightx = 1.0;
        gridBagConstraints.anchor = 10;
        ++gridBagConstraints.gridx;
        ((Container)serializable3).add(this.g, gridBagConstraints);
        ++gridBagConstraints.gridx;
        ((Container)serializable3).add(new JLabel("Alert threshold (>=)"), gridBagConstraints);
        ++gridBagConstraints.gridx;
        gridBagConstraints.anchor = 22;
        ((Container)serializable3).add(this.i, gridBagConstraints);
        this.setLayout(new BoxLayout((Container)((Object)this), 1));
        this.add((Component)serializable3);
        this.add(jPanel);
        this.add((Component)serializable);
        this.add((Component)serializable2);
    }

    void c(boolean bl) {
        d d2 = this.a.c();
        this.c.setText(bl ? d2.stopsAlertTemplate : d2.icebergsAlertTemplate);
        this.p.run();
        this.g.setSelected(bl ? d2.stopsAlertEnabled : d2.icebergsAlertEnabled);
        if (bl && d2.stopsAlertAutoThreshold) {
            this.a.b(true);
        } else if (!bl && d2.icebergsAlertAutoThreshold) {
            this.a.c(true);
        }
        TelegramSettingsExtended telegramSettingsExtended = d2.telegramSettings;
        this.h.setSelected(bl ? telegramSettingsExtended.b() : telegramSettingsExtended.a());
        this.i.setValue(bl ? d2.stopsAlertThreshold : d2.icebergsAlertThreshold);
        this.j.setSelected(d2.showOnlyStopsTBPLAlerts);
        this.k.setValue(bl ? d2.stopsAlertSdInterval : d2.icebergsAlertSdInterval);
        this.k.setEnabled(bl ? d2.stopsAlertAutoThreshold : d2.icebergsAlertAutoThreshold);
        this.a(bl ? d2.stopsAlertSdMultiplier : d2.icebergsAlertSdMultiplier, this.n);
        this.l.setText(Double.toString(this.a(this.n)));
        this.o.setSelected(bl ? d2.stopsAlertAutoThreshold : d2.icebergsAlertAutoThreshold);
        this.i.setEnabled(!this.o.isSelected());
        this.k.setEnabled(this.o.isSelected());
        this.n.setEnabled(this.o.isSelected());
        this.l.setEnabled(this.o.isSelected());
    }

    private double a(JSlider jSlider) {
        return (double)jSlider.getValue() / 10.0;
    }

    void a(double d2, JSlider jSlider) {
        jSlider.setValue((int)(d2 * 10.0));
    }

    private static /* synthetic */ void a(JPanel jPanel, JPanel jPanel2, JPanel jPanel3, JButton jButton, ActionEvent actionEvent) {
        boolean bl = !jPanel.isVisible();
        jPanel.setVisible(bl);
        jPanel2.setVisible(bl);
        jPanel3.setVisible(bl);
        if (bl) {
            jButton.setIcon(SitIndicator.r);
        } else {
            jButton.setIcon(SitIndicator.q);
        }
    }
}

