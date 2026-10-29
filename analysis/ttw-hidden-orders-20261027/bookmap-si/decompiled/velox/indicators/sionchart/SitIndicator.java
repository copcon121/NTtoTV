/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.Layer1ApiProvider
 *  velox.api.layer1.annotations.Layer1ApiVersion
 *  velox.api.layer1.annotations.Layer1ApiVersionValue
 *  velox.api.layer1.annotations.Layer1SimpleAttachable
 *  velox.api.layer1.annotations.Layer1StrategyDateLicensed
 *  velox.api.layer1.annotations.Layer1StrategyName
 *  velox.api.layer1.data.InstrumentInfo
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$PreparedImage
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainter
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainterFactory
 *  velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyScreenSpacePainter
 *  velox.api.layer1.providers.helper.TargetedRequestHelper
 *  velox.api.layer1.simplified.Api
 *  velox.api.layer1.simplified.CustomModuleAdapter
 *  velox.api.layer1.simplified.CustomSettingsPanelProvider
 *  velox.api.layer1.simplified.HistoricalModeListener
 *  velox.api.layer1.simplified.InitialState
 *  velox.api.layer1.simplified.NoAutosubscription
 *  velox.api.layer1.simplified.TimeListener
 *  velox.api.layer1.simplified.TradeDataListener
 *  velox.gui.StrategyPanel
 *  velox.gui.utils.GuiUtils
 */
package velox.indicators.sionchart;

import a.a.a.a.a.a.c;
import a.a.a.a.b;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.LayoutManager;
import java.awt.event.ActionEvent;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.imageio.ImageIO;
import javax.swing.AbstractButton;
import javax.swing.BoxLayout;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JSeparator;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import velox.api.layer1.Layer1ApiProvider;
import velox.api.layer1.annotations.Layer1ApiVersion;
import velox.api.layer1.annotations.Layer1ApiVersionValue;
import velox.api.layer1.annotations.Layer1SimpleAttachable;
import velox.api.layer1.annotations.Layer1StrategyDateLicensed;
import velox.api.layer1.annotations.Layer1StrategyName;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainter;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainterFactory;
import velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyScreenSpacePainter;
import velox.api.layer1.providers.helper.TargetedRequestHelper;
import velox.api.layer1.simplified.Api;
import velox.api.layer1.simplified.CustomModuleAdapter;
import velox.api.layer1.simplified.CustomSettingsPanelProvider;
import velox.api.layer1.simplified.HistoricalModeListener;
import velox.api.layer1.simplified.InitialState;
import velox.api.layer1.simplified.NoAutosubscription;
import velox.api.layer1.simplified.TimeListener;
import velox.api.layer1.simplified.TradeDataListener;
import velox.gui.StrategyPanel;
import velox.gui.utils.GuiUtils;
import velox.indicators.sionchart.TelegramSettingsExtended;
import velox.indicators.sionchart.a;
import velox.indicators.sionchart.a.i;
import velox.indicators.sionchart.b_0;
import velox.indicators.sionchart.c_0;
import velox.indicators.sionchart.d;
import velox.indicators.sionchart.d_0;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.g;
import velox.indicators.sionchart.h;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.k;
import velox.indicators.sionchart.l;
import velox.indicators.sionchart.m;
import velox.indicators.sionchart.n;
import velox.indicators.sionchart.o;
import velox.indicators.sionchart.p;
import velox.indicators.sionchart.q;
import velox.indicators.sionchart.r;
import velox.indicators.sionchart.s;
import velox.indicators.sionchart.t;
import velox.indicators.sionchart.u;

@NoAutosubscription
@Layer1SimpleAttachable
@Layer1StrategyName(value="Stops&Icebergs On-Chart")
@Layer1StrategyDateLicensed(value="BM.Indicators.IcebergsTracker")
@Layer1ApiVersion(value=Layer1ApiVersionValue.VERSION2)
public class SitIndicator
implements ScreenSpacePainterFactory,
CustomModuleAdapter,
CustomSettingsPanelProvider,
HistoricalModeListener {
    public static final String a = "Stops&Icebergs On-Chart";
    public static final String b = "v.1.05";
    private static final long v = 60000000000L;
    public static final Color c = new Color(0, 153, 255);
    public static final Color d = new Color(0, 153, 255);
    public static final Color e = new Color(255, 0, 0);
    public static final Color f = new Color(255, 0, 0);
    Api g;
    d h;
    String i;
    u j;
    double k;
    volatile boolean l = false;
    e m;
    d_0 n;
    private a w;
    private t x;
    private final g y = new g();
    private h z;
    private b_0 A;
    private final Map<k, ScreenSpaceCanvas.PreparedImage> B = new ConcurrentHashMap<k, ScreenSpaceCanvas.PreparedImage>();
    private final Map<k, ScreenSpaceCanvas.PreparedImage> C = new ConcurrentHashMap<k, ScreenSpaceCanvas.PreparedImage>();
    private final Map<k, ScreenSpaceCanvas.PreparedImage> D = new ConcurrentHashMap<k, ScreenSpaceCanvas.PreparedImage>();
    final Map<k, ScreenSpaceCanvas.PreparedImage> o = new ConcurrentHashMap<k, ScreenSpaceCanvas.PreparedImage>();
    final Map<k, ScreenSpaceCanvas.PreparedImage> p = new ConcurrentHashMap<k, ScreenSpaceCanvas.PreparedImage>();
    public static final ImageIcon q = new ImageIcon(SitIndicator.class.getResource("/resources/icons/bottom_panel_show.png"));
    public static final ImageIcon r = new ImageIcon(SitIndicator.class.getResource("/resources/icons/bottom_panel_hide.png"));
    private long E = 0L;
    private long F = 0L;
    private final ExecutorService G = Executors.newFixedThreadPool(2);
    private final ExecutorService H = Executors.newFixedThreadPool(2);
    final a.a.a.a.a.a s = a.a.a.a.a.a.a;
    TelegramSettingsExtended t;
    ExecutorService u;

    public void initialize(String string, InstrumentInfo instrumentInfo, Api api, InitialState initialState) {
        this.l = velox.indicators.sionchart.a.t.a("7.1.0.50", a);
        if (this.l) {
            try {
                this.l = TargetedRequestHelper.getSupportedFeaturesForAlias((Layer1ApiProvider)api.getProvider(), (String)string).mbo;
            }
            catch (Exception exception) {
                // empty catch block
            }
            if (!this.l) {
                SwingUtilities.invokeLater(() -> {
                    JLabel jLabel = new JLabel("Instrument " + string + " does not provide MBO data. Please check that data aggregation is disabled in the connection configuration.");
                    JOptionPane.showMessageDialog(null, jLabel, "No MBO data", 1);
                });
            }
        }
        if (this.l) {
            this.g = api;
            this.i = string;
            this.k = instrumentInfo.pips;
            this.h = this.c();
            this.z = new h(this);
            this.A = new b_0(this, false);
            a.a.b.a.a.a a2 = new a.a.b.a.a.a();
            a2.a(this::a);
            a2.b(this::a);
            velox.indicators.sionchart.a.s s2 = new velox.indicators.sionchart.a.s();
            s2.b.addAll(Arrays.asList(this.y, this.z, a2, this.A));
            s2.c.addAll(Arrays.asList(this.y, this.z, a2, this.A));
            s2.a.addAll(Arrays.asList(this.y, this.z, this.A));
            api.addMarketByOrderDepthDataListeners(velox.indicators.sionchart.a.p.a(s2));
            api.addTradeDataListeners((TradeDataListener)s2);
            api.addTimeListeners((TimeListener)s2);
            api.addHistoricalModeListeners((HistoricalModeListener)this);
            SwingUtilities.invokeLater(() -> {
                this.m = new e(this);
                this.n = new d_0(this);
                this.j = new u(this);
                this.w = new a(this);
            });
            this.B.put(velox.indicators.sionchart.k.TRADE, this.b("Iceberg"));
            this.B.put(velox.indicators.sionchart.k.DETECTED, this.b("Iceberg"));
            this.B.put(velox.indicators.sionchart.k.CANCELED, this.b("Iceberg"));
            this.B.put(velox.indicators.sionchart.k.EXECUTED, this.b("Iceberg"));
            this.B.put(velox.indicators.sionchart.k.ACTIVE, this.b("Iceberg"));
            this.B.put(velox.indicators.sionchart.k.STOP, this.b("Stop"));
            this.u = a.a.a.a.a.a();
            this.t = this.h.telegramSettings;
            this.d();
            this.a();
        }
    }

    public void stop() {
        if (this.l) {
            this.l = false;
            this.b();
            if (this.j != null) {
                this.j.a(true);
            }
            if (velox.indicators.sionchart.u.c != null) {
                velox.indicators.sionchart.u.c.dispose();
                velox.indicators.sionchart.u.c = null;
            }
        }
    }

    public void a(String string) {
        l l2 = (l)this.y.c.get(string);
        if (l2 != null) {
            this.z.a(l2);
        }
    }

    public void a(boolean bl) {
        this.A.a(bl);
    }

    private ScreenSpaceCanvas.PreparedImage b(String string) {
        BufferedImage bufferedImage;
        try {
            bufferedImage = ImageIO.read(this.getClass().getResourceAsStream("/resources/icons/" + string + ".png"));
        }
        catch (IOException iOException) {
            throw new RuntimeException("Error on icon file load: " + iOException.getMessage());
        }
        return new ScreenSpaceCanvas.PreparedImage(bufferedImage);
    }

    public ScreenSpacePainter createScreenSpacePainter(String string, String string2, ScreenSpaceCanvasFactory screenSpaceCanvasFactory) {
        if (this.l && string.endsWith(":" + string2)) {
            this.x = new t(this.g, screenSpaceCanvasFactory, this.z, this.A, this.C, this.D, this);
            return this.x;
        }
        return new m(this);
    }

    void a(Map<k, ScreenSpaceCanvas.PreparedImage> map, Map<k, ScreenSpaceCanvas.PreparedImage> map2, Color color, Color color2) {
        for (Map.Entry<k, ScreenSpaceCanvas.PreparedImage> entry : map.entrySet()) {
            BufferedImage bufferedImage = velox.indicators.sionchart.a.i.a(entry.getValue().getReadOnlyImage(), entry.getKey() == velox.indicators.sionchart.k.STOP ? color2 : color);
            map2.put(entry.getKey(), new ScreenSpaceCanvas.PreparedImage(bufferedImage));
        }
    }

    private Layer1ApiUserMessageModifyScreenSpacePainter a(String string, boolean bl) {
        return Layer1ApiUserMessageModifyScreenSpacePainter.builder(SitIndicator.class, (String)string).setIsAdd(bl).setScreenSpacePainterFactory((ScreenSpacePainterFactory)this).build();
    }

    public void a() {
        Layer1ApiUserMessageModifyScreenSpacePainter layer1ApiUserMessageModifyScreenSpacePainter = this.a("Stops&Icebergs On-Chart:" + this.i, true);
        this.g.sendUserMessage((Object)layer1ApiUserMessageModifyScreenSpacePainter);
    }

    public void b() {
        Layer1ApiUserMessageModifyScreenSpacePainter layer1ApiUserMessageModifyScreenSpacePainter = this.a("Stops&Icebergs On-Chart:" + this.i, false);
        this.g.sendUserMessage((Object)layer1ApiUserMessageModifyScreenSpacePainter);
    }

    public void onRealtimeStart() {
        if (this.l && this.x != null) {
            this.x.onMoveEnd();
        }
    }

    protected d c() {
        if (this.h == null) {
            this.h = this.g != null ? (d)this.g.getSettings(d.class) : new d();
        }
        return this.h;
    }

    protected void d() {
        d d2 = this.c();
        d2.setHiddenColors();
        this.a(this.B, this.C, d2.icebergsBidColor, d2.stopsBidColor);
        this.a(this.B, this.D, d2.icebergsAskColor, d2.stopsAskColor);
        this.a(this.B, this.o, d2.getIcebergsHiddenBidColor(), d2.getStopsHiddenBidColor());
        this.a(this.B, this.p, d2.getIcebergsHiddenAskColor(), d2.getStopsHiddenAskColor());
        if (this.g != null) {
            this.g.setSettings((Object)d2);
        }
        if (this.x != null) {
            this.x.a();
            this.x.onMoveEnd();
        }
    }

    public StrategyPanel[] getCustomSettingsPanels() {
        if (this.l) {
            return SitIndicator.a(this.g, this.m, this.n, this.j, this.e(), this.w);
        }
        return SitIndicator.getCustomDisabledSettingsPanels();
    }

    private static StrategyPanel[] a(Api api, e e2, d_0 d_02, u u2, StrategyPanel strategyPanel, a a2) {
        JPanel jPanel = new JPanel();
        jPanel.setLayout(new GridBagLayout());
        jPanel.setVisible(false);
        Serializable serializable = new GridBagConstraints();
        ((GridBagConstraints)serializable).fill = 2;
        ((GridBagConstraints)serializable).insets = new Insets(5, 5, 5, 5);
        ((GridBagConstraints)serializable).weightx = 2.0;
        ((GridBagConstraints)serializable).gridx = 0;
        ((GridBagConstraints)serializable).gridy = 0;
        ((GridBagConstraints)serializable).gridwidth = -1;
        JComponent jComponent = new JLabel("Aggregated threshold (>=)");
        jComponent.setToolTipText("Filter applied after icons aggregation");
        jPanel.add((Component)jComponent, serializable);
        ++((GridBagConstraints)serializable).gridy;
        ((GridBagConstraints)serializable).gridwidth = 0;
        jPanel.add((Component)new JSeparator(0), serializable);
        ((GridBagConstraints)serializable).gridwidth = -1;
        ++((GridBagConstraints)serializable).gridy;
        Serializable serializable2 = new JLabel("Individual threshold (>=)");
        jPanel.add((Component)serializable2, serializable);
        ((JComponent)serializable2).setToolTipText("<html>Only orders which total traded size is more or equal to  <br>the selected value would be indicated on the screen</html>");
        ++((GridBagConstraints)serializable).gridy;
        ((GridBagConstraints)serializable).gridwidth = 0;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.w, "Sets automatic size threshold based on the current settings"), serializable);
        ((GridBagConstraints)serializable).gridwidth = -1;
        ++((GridBagConstraints)serializable).gridy;
        Serializable serializable3 = new JLabel("SD interval, minutes");
        ((JComponent)serializable3).setToolTipText("Sets the time interval (moving window) to calculate the standard deviation on");
        jPanel.add((Component)serializable3, serializable);
        ++((GridBagConstraints)serializable).gridy;
        JComponent jComponent2 = new JLabel("SD multiplier");
        jComponent2.setToolTipText("Sets the standard deviation multiplier. The higher the value is - the higher is the threshold");
        jPanel.add((Component)jComponent2, serializable);
        ++((GridBagConstraints)serializable).gridy;
        ((GridBagConstraints)serializable).gridwidth = 0;
        jPanel.add((Component)new JSeparator(0), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.v, "Apply size threshold to active (partially filled) icebergs"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new JSeparator(0), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.x, "Show the icons filtered out by the filters"), serializable);
        ((GridBagConstraints)serializable).gridwidth = -1;
        ++((GridBagConstraints)serializable).gridy;
        Serializable serializable4 = new JLabel("Filtered icons transparency");
        serializable4.setToolTipText("Transparency of the icons filtered out by the filters");
        jPanel.add((Component)serializable4);
        ++((GridBagConstraints)serializable).gridy;
        ((GridBagConstraints)serializable).gridwidth = 0;
        jPanel.add((Component)new JSeparator(0), serializable);
        ((GridBagConstraints)serializable).gridwidth = -1;
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)e2.m, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)e2.p, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)e2.q, serializable);
        ++((GridBagConstraints)serializable).gridy;
        ((GridBagConstraints)serializable).gridwidth = 0;
        jPanel.add((Component)new JSeparator(0), serializable);
        ((GridBagConstraints)serializable).gridwidth = -1;
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)e2.s, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)e2.r, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new JLabel("Sells color"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new JLabel("Buys color"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        JLabel jLabel = new JLabel("Icons size");
        jPanel.add((Component)jLabel, serializable);
        jLabel.setToolTipText("Sets the icons size");
        ++((GridBagConstraints)serializable).gridy;
        StrategyPanel[] strategyPanelArray = new JLabel("Icons offset");
        jPanel.add((Component)strategyPanelArray, serializable);
        strategyPanelArray.setToolTipText("Sets the length of the icons offset lines");
        ++((GridBagConstraints)serializable).gridy;
        StrategyPanel[] strategyPanelArray2 = new JLabel("Order line width");
        jPanel.add((Component)strategyPanelArray2, serializable);
        strategyPanelArray2.setToolTipText("Sets the order line width");
        ++((GridBagConstraints)serializable).gridy;
        JLabel jLabel2 = new JLabel("Offset line width");
        jPanel.add((Component)jLabel2, serializable);
        jLabel2.setToolTipText("Sets the icons offset lines width");
        ++((GridBagConstraints)serializable).gridy;
        ((GridBagConstraints)serializable).gridwidth = 0;
        jPanel.add((Component)new JSeparator(0), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.z, "Disable icons aggregation"), serializable);
        ((GridBagConstraints)serializable).gridwidth = -1;
        ++((GridBagConstraints)serializable).gridy;
        JLabel jLabel3 = new JLabel("Price aggregation (vertical)");
        jPanel.add((Component)jLabel3, serializable);
        jLabel3.setToolTipText("Sets the vertical size of the area to be aggregated in the icon heights");
        ++((GridBagConstraints)serializable).gridy;
        JLabel jLabel42 = new JLabel("Time aggregation (horizontal)");
        jPanel.add((Component)jLabel42, serializable);
        jLabel42.setToolTipText("Sets the horizontal size of the area to be aggregated in the icon widths");
        ((GridBagConstraints)serializable).weightx = 3.0;
        ((GridBagConstraints)serializable).gridx = 1;
        ((GridBagConstraints)serializable).gridy = 0;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.k, "Filter applied after aggregation"), serializable);
        ((GridBagConstraints)serializable).gridy += 2;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.j, "<html>Only orders which total traded size is more or equal to  <br>the selected value would be indicated on the screen</html>"), serializable);
        ((GridBagConstraints)serializable).gridy += 2;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.A, "Sets the time interval (moving window) to calculate the standard deviation on"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.B, "Sets the standard deviation multiplier. The higher the value is - the higher is the threshold"), serializable);
        ((GridBagConstraints)serializable).gridy += 5;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.C, "Transparency of the icons filtered out by the aggregated filter"), serializable);
        ((GridBagConstraints)serializable).gridy += 2;
        jPanel.add((Component)e2.n, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)e2.o, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)e2.y, serializable);
        ((GridBagConstraints)serializable).gridy += 2;
        jPanel.add((Component)e2.t, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)e2.u, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)e2.h, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)e2.i, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.b, "Sets the icons size"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.c, "Sets the length of the icons offset lines"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.d, "Sets the order line width"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.e, "Sets the icons offset lines width"), serializable);
        ((GridBagConstraints)serializable).gridy += 3;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.f, "Sets the vertical size of the area to be aggregated in the icon heights"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(e2.g, "Sets the horizontal size of the area to be aggregated in the icon widths"), serializable);
        serializable = new JPanel();
        ((Container)serializable).setLayout(new GridBagLayout());
        jComponent = new JButton();
        ((AbstractButton)jComponent).setIcon(q);
        jComponent.setPreferredSize(new Dimension(22, 22));
        ((AbstractButton)jComponent).addActionListener(arg_0 -> SitIndicator.c(jPanel, (JButton)jComponent, arg_0));
        serializable2 = new GridBagConstraints();
        ((GridBagConstraints)serializable2).insets = new Insets(4, 2, 4, 2);
        ((GridBagConstraints)serializable2).weightx = 0.0;
        ((GridBagConstraints)serializable2).gridx = 0;
        ((GridBagConstraints)serializable2).gridy = 0;
        ((GridBagConstraints)serializable2).anchor = 21;
        ((Container)serializable).add(jComponent, serializable2);
        ((GridBagConstraints)serializable2).gridx = 1;
        ((GridBagConstraints)serializable2).weightx = 1.0;
        ((Container)serializable).add(e2.l, serializable2);
        jComponent = new StrategyPanel("Icebergs visual settings");
        jComponent.setLayout(new BoxLayout(jComponent, 1));
        jComponent.add((Component)serializable);
        jComponent.add(jPanel);
        serializable2 = new JPanel();
        ((Container)serializable2).setLayout(new GridBagLayout());
        ((JComponent)serializable2).setVisible(false);
        serializable3 = new GridBagConstraints();
        ((GridBagConstraints)serializable3).fill = 2;
        ((GridBagConstraints)serializable3).insets = new Insets(5, 5, 5, 5);
        ((GridBagConstraints)serializable3).weightx = 3.0;
        ((GridBagConstraints)serializable3).gridx = 0;
        ((GridBagConstraints)serializable3).gridy = 0;
        jComponent2 = new JLabel("Aggregated threshold (>=)");
        jComponent2.setToolTipText("Filter applied after icons aggregation");
        ((Container)serializable2).add(jComponent2, serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((GridBagConstraints)serializable3).gridwidth = 0;
        ((Container)serializable2).add(new JSeparator(0), serializable3);
        ((GridBagConstraints)serializable3).gridwidth = -1;
        ++((GridBagConstraints)serializable3).gridy;
        serializable4 = new JLabel("Individual threshold (>=)");
        ((Container)serializable2).add((Component)serializable4, serializable3);
        serializable4.setToolTipText("<html>Only stop chains which total traded size is more or equal <br>to the selected value would be indicated on the screen</html>");
        ++((GridBagConstraints)serializable3).gridy;
        ((GridBagConstraints)serializable3).gridwidth = 0;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.r, "Sets automatic size threshold based on the current settings"), serializable3);
        ((GridBagConstraints)serializable3).gridwidth = -1;
        ++((GridBagConstraints)serializable3).gridy;
        jLabel = new JLabel("SD interval, minutes");
        jLabel.setToolTipText("Sets the time interval (moving window) to calculate the standard deviation on");
        ((Container)serializable2).add(jLabel, serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        strategyPanelArray = new JLabel("SD multiplier");
        strategyPanelArray.setToolTipText("Sets the standard deviation multiplier. The higher the value is - the higher is the threshold");
        ((Container)serializable2).add((Component)strategyPanelArray, serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((GridBagConstraints)serializable3).gridwidth = 0;
        ((Container)serializable2).add(new JSeparator(0), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.f, "Show only stop chains executed on multiple price levels"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new JSeparator(0), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.j, "Show the icons filtered out by the filters"), serializable3);
        ((GridBagConstraints)serializable3).gridwidth = -1;
        ++((GridBagConstraints)serializable3).gridy;
        strategyPanelArray2 = new JLabel("Filtered icons transparency");
        strategyPanelArray2.setToolTipText("Transparency of the icons filtered out by the filters");
        ((Container)serializable2).add((Component)strategyPanelArray2);
        ++((GridBagConstraints)serializable3).gridy;
        ((GridBagConstraints)serializable3).gridwidth = 0;
        ((Container)serializable2).add(new JSeparator(0), serializable3);
        ((GridBagConstraints)serializable3).gridwidth = -1;
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(d_02.h, serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new JLabel("Sells color"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new JLabel("Buys color"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        jLabel2 = new JLabel("Icons size");
        ((Container)serializable2).add(jLabel2, serializable3);
        jLabel2.setToolTipText("Sets the icons size");
        ++((GridBagConstraints)serializable3).gridy;
        jLabel3 = new JLabel("Icons offset");
        ((Container)serializable2).add(jLabel3, serializable3);
        jLabel3.setToolTipText("Sets the length of the icons offset lines");
        ++((GridBagConstraints)serializable3).gridy;
        JLabel jLabel4 = new JLabel("Order line width");
        ((Container)serializable2).add(jLabel4, serializable3);
        jLabel4.setToolTipText("Sets the order line width");
        ++((GridBagConstraints)serializable3).gridy;
        JLabel jLabel5 = new JLabel("Offset line width");
        ((Container)serializable2).add(jLabel5, serializable3);
        jLabel5.setToolTipText("Sets the icons offset lines width");
        ++((GridBagConstraints)serializable3).gridy;
        ((GridBagConstraints)serializable3).gridwidth = 0;
        ((Container)serializable2).add(new JSeparator(0), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.k, "Disable icons aggregation"), serializable3);
        ((GridBagConstraints)serializable3).gridwidth = -1;
        ++((GridBagConstraints)serializable3).gridy;
        JLabel jLabel6 = new JLabel("Price aggregation (vertical)");
        ((Container)serializable2).add(jLabel6, serializable3);
        jLabel6.setToolTipText("Sets the vertical size of the area to be aggregated in the icon heights");
        ++((GridBagConstraints)serializable3).gridy;
        JLabel jLabel7 = new JLabel("Time aggregation (horizontal)");
        ((Container)serializable2).add(jLabel7, serializable3);
        jLabel7.setToolTipText("Sets the horizontal size of the area to be aggregated in the icon widths");
        ((GridBagConstraints)serializable3).weightx = 2.0;
        ((GridBagConstraints)serializable3).gridx = 1;
        ((GridBagConstraints)serializable3).gridy = 0;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.e, "Filter applied after aggregation"), serializable3);
        ((GridBagConstraints)serializable3).gridy += 2;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.d, "<html>Only stop chains which total traded size is more or equal <br>to the selected value would be indicated on the screen</html>"), serializable3);
        ((GridBagConstraints)serializable3).gridy += 2;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.s, "Sets the time interval (moving window) to calculate the standard deviation on"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.t, "Sets the standard deviation multiplier. The higher the value is - the higher is the threshold"), serializable3);
        ((GridBagConstraints)serializable3).gridy += 5;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.u, "Transparency of the icons filtered out by the aggregated filter"), serializable3);
        ((GridBagConstraints)serializable3).gridy += 2;
        ((Container)serializable2).add(d_02.i, serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add((Component)d_02.b, serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add((Component)d_02.c, serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.l, "Sets the icons size"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.m, "Sets the length of the icons offset lines"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.n, "Sets the order line width"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.o, "Sets the icons offset lines width"), serializable3);
        ((GridBagConstraints)serializable3).gridy += 3;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.p, "Sets the vertical size of the area to be aggregated in the icon heights"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(d_02.q, "Sets the horizontal size of the area to be aggregated in the icon widths"), serializable3);
        serializable3 = new JPanel();
        ((Container)serializable3).setLayout(new GridBagLayout());
        jComponent2 = new JButton();
        ((AbstractButton)jComponent2).setIcon(q);
        jComponent2.setPreferredSize(new Dimension(22, 22));
        jComponent2.setMaximumSize(new Dimension(22, 22));
        ((AbstractButton)jComponent2).addActionListener(arg_0 -> SitIndicator.b((JPanel)serializable2, (JButton)jComponent2, arg_0));
        serializable4 = new GridBagConstraints();
        ((GridBagConstraints)serializable4).insets = new Insets(4, 2, 4, 2);
        ((GridBagConstraints)serializable4).weightx = 0.0;
        ((GridBagConstraints)serializable4).gridx = 0;
        ((GridBagConstraints)serializable4).gridy = 0;
        ((GridBagConstraints)serializable4).anchor = 21;
        ((Container)serializable3).add(jComponent2, serializable4);
        ((GridBagConstraints)serializable4).weightx = 1.0;
        ((GridBagConstraints)serializable4).gridx = 1;
        ((Container)serializable3).add(d_02.g, serializable4);
        jComponent2 = new StrategyPanel("Stops visual settings");
        jComponent2.setLayout(new BoxLayout(jComponent2, 1));
        jComponent2.add((Component)serializable3);
        jComponent2.add((Component)serializable2);
        serializable4 = new StrategyPanel("Reset settings");
        serializable4.setLayout(new GridBagLayout());
        serializable4.add(a2.a);
        jLabel = new StrategyPanel(null);
        jLabel.setLayout(new BorderLayout());
        jLabel.add(new JLabel("Stops&Icebergs On-Chart v.1.05"), "East");
        strategyPanelArray = new StrategyPanel[]{jComponent, u2.d, jComponent2, u2.e, strategyPanel, serializable4, jLabel};
        if (api == null) {
            for (StrategyPanel strategyPanel2 : strategyPanelArray) {
                GuiUtils.setPanelEnabled((JPanel)strategyPanel2, (Boolean)false);
            }
        }
        return strategyPanelArray;
    }

    public static StrategyPanel[] getCustomDisabledSettingsPanels() {
        SitIndicator sitIndicator = new SitIndicator();
        Runnable runnable = () -> {};
        return SitIndicator.a(null, new e(sitIndicator), new d_0(sitIndicator), new u(sitIndicator), SitIndicator.a(a.a.a.a.a.a.a, new a.a.a.a.d(), a.a.a.a.a.a(), runnable), new a(sitIndicator));
    }

    private StrategyPanel e() {
        Runnable runnable = this::d;
        return SitIndicator.a(this.s, this.t, this.u, runnable);
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private void a(long l2, boolean bl, boolean bl2) {
        int n2 = 0;
        ArrayList<c_0> arrayList = new ArrayList<c_0>();
        List<c_0> list = this.A.b;
        synchronized (list) {
            for (c_0 c_02 : this.A.b) {
                if (c_02.a.get((int)0).c < l2) continue;
                arrayList.add(c_02);
            }
        }
        if (arrayList.size() > 0) {
            int n3;
            int n4 = 0;
            for (c_0 c_02 : arrayList) {
                n2 += c_02.b;
                if (c_02.b <= n4) continue;
                n4 = c_02.b;
            }
            double d2 = (double)n2 / (double)arrayList.size();
            double d3 = 0.0;
            for (c_0 c_03 : arrayList) {
                d3 += Math.pow((double)c_03.b - d2, 2.0);
            }
            double d4 = d3 / (double)arrayList.size();
            double d5 = Math.sqrt(d4);
            if (bl || bl2) {
                n3 = (int)(d2 + d5 * this.h.stopsAlertSdMultiplier);
                if (n3 > n4) {
                    n3 = n4;
                }
                this.h.stopsAlertThreshold = n3;
            }
            if (!bl || bl2) {
                n3 = (int)(d2 + d5 * this.h.stopsSdMultiplier);
                if (n3 > n4) {
                    n3 = n4;
                }
                this.h.stopsThreshold = n3;
            }
        } else {
            if (bl || bl2) {
                this.h.stopsAlertThreshold = 0;
            }
            if (!bl || bl2) {
                this.h.stopsThreshold = 0;
            }
        }
        SwingUtilities.invokeLater(() -> {
            this.n.d.setValue(this.h.stopsThreshold);
            this.j.e.i.setValue(this.h.stopsAlertThreshold);
            this.x.onMoveEnd();
        });
    }

    public void b(boolean bl) {
        if (this.h.showStops || this.h.stopsAlertEnabled) {
            long l2 = this.g.getProvider().getCurrentTime();
            if (bl || l2 - this.E > 60000000000L) {
                if (this.A.b.size() > 0) {
                    Thread thread;
                    this.E = l2;
                    if (this.h.showStops && this.h.stopsAutoThreshold && this.h.stopsAlertEnabled && this.h.stopsAlertAutoThreshold && this.h.stopsSdInterval == this.h.stopsAlertSdInterval) {
                        n n2 = new n(this, "Calc stops threshold thread", l2);
                        this.G.submit(n2);
                        return;
                    }
                    if (this.h.showStops && this.h.stopsAutoThreshold) {
                        thread = new o(this, "Calc stops threshold thread", l2);
                        this.G.submit(thread);
                    }
                    if (this.h.stopsAlertEnabled && this.h.stopsAlertAutoThreshold) {
                        thread = new p(this, "Calc stops alerts threshold thread", l2);
                        this.G.submit(thread);
                    }
                } else {
                    if (this.h.stopsAutoThreshold) {
                        this.h.stopsThreshold = 0;
                        SwingUtilities.invokeLater(() -> this.n.d.setValue(this.h.stopsThreshold));
                    }
                    if (this.h.stopsAlertAutoThreshold) {
                        this.h.stopsAlertThreshold = 0;
                        SwingUtilities.invokeLater(() -> this.j.e.i.setValue(this.h.stopsAlertThreshold));
                    }
                }
            }
        }
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private void b(long l2, boolean bl, boolean bl2) {
        int n2 = 0;
        ArrayList<l> arrayList = new ArrayList<l>();
        Map map = this.z.c;
        synchronized (map) {
            for (l l3 : this.z.c.values()) {
                if (((j)l3.k.get((int)0)).c < l2 || (!this.h.showExecution || ((j)l3.k.get((int)(l3.k.size() - 1))).b != velox.indicators.sionchart.k.EXECUTED) && (!this.h.showCancellation || ((j)l3.k.get((int)(l3.k.size() - 1))).b != velox.indicators.sionchart.k.CANCELED)) continue;
                arrayList.add(l3);
            }
        }
        if (arrayList.size() > 0) {
            int n3;
            int n4 = 0;
            for (l l3 : arrayList) {
                n2 += l3.a();
                if (l3.a() <= n4) continue;
                n4 = l3.a();
            }
            double d2 = (double)n2 / (double)arrayList.size();
            double d3 = 0.0;
            for (l l4 : arrayList) {
                d3 += Math.pow((double)l4.a() - d2, 2.0);
            }
            double d4 = d3 / (double)arrayList.size();
            double d5 = Math.sqrt(d4);
            if (bl || bl2) {
                n3 = (int)(d2 + d5 * this.h.icebergsAlertSdMultiplier);
                if (n3 > n4) {
                    n3 = n4;
                }
                this.h.icebergsAlertThreshold = n3;
            }
            if (!bl || bl2) {
                n3 = (int)(d2 + d5 * this.h.icebergsSdMultiplier);
                if (n3 > n4) {
                    n3 = n4;
                }
                this.h.icebergsThreshold = n3;
            }
        } else {
            if (bl || bl2) {
                this.h.icebergsAlertThreshold = 0;
            }
            if (!bl || bl2) {
                this.h.icebergsThreshold = 0;
            }
        }
        SwingUtilities.invokeLater(() -> {
            if (bl || bl2) {
                this.j.d.i.setValue(this.h.icebergsAlertThreshold);
            }
            if (!bl || bl2) {
                this.m.j.setValue(this.h.icebergsThreshold);
            }
            this.x.onMoveEnd();
        });
    }

    public void c(boolean bl) {
        if (this.h.showIcebergs || this.h.icebergsAlertEnabled) {
            long l2 = this.g.getProvider().getCurrentTime();
            if (bl || l2 - this.F > 60000000000L) {
                if (this.z.c.size() > 0) {
                    Thread thread;
                    this.F = l2;
                    if (this.h.showIcebergs && this.h.icebergsAutoThreshold && this.h.icebergsAlertEnabled && this.h.icebergsAlertAutoThreshold && this.h.icebergsSdInterval == this.h.icebergsAlertSdInterval) {
                        q q2 = new q(this, "Calc icebergs threshold thread", l2);
                        this.H.submit(q2);
                        return;
                    }
                    if (this.h.showIcebergs && this.h.icebergsAutoThreshold) {
                        thread = new r(this, "Calc icebergs threshold thread", l2);
                        this.H.submit(thread);
                    }
                    if (this.h.icebergsAlertEnabled && this.h.icebergsAlertAutoThreshold) {
                        thread = new s(this, "Calc icebergs alerts threshold thread", l2);
                        this.H.submit(thread);
                    }
                } else {
                    this.h.icebergsThreshold = 0;
                    SwingUtilities.invokeLater(() -> this.m.j.setValue(this.h.icebergsThreshold));
                }
            }
        }
    }

    public static StrategyPanel a(a.a.a.a.a.a a2, a.a.a.a.d d2, ExecutorService executorService, Runnable runnable) {
        StrategyPanel strategyPanel = new StrategyPanel("Telegram configuration");
        strategyPanel.setLayout((LayoutManager)new GridBagLayout());
        JPanel jPanel = new JPanel();
        JPanel jPanel2 = new JPanel();
        jPanel2.setVisible(false);
        Serializable serializable = new GridBagConstraints();
        serializable.fill = 2;
        serializable.weightx = 1.0;
        serializable.insets = new Insets(0, 0, 0, 0);
        serializable.gridx = 0;
        serializable.gridy = 0;
        strategyPanel.add((Component)jPanel, (Object)serializable);
        ++serializable.gridy;
        strategyPanel.add((Component)jPanel2, (Object)serializable);
        jPanel2.setLayout(new BoxLayout(jPanel2, 1));
        a.a.a.a.d.a.a(jPanel2, "Token", d2.getToken(), (String string) -> {
            d2.setToken((String)string);
            runnable.run();
        });
        a.a.a.a.d.a.a(jPanel2, "Chat ID", d2.getChatId(), (String string) -> {
            d2.setChatId((String)string);
            runnable.run();
        });
        serializable = new JLabel("<html>We recommend using the Telegram Desktop application for better user experience during the configuration process.</html>");
        JPanel jPanel3 = new JPanel();
        jPanel3.setBorder(new EmptyBorder(10, 10, 10, 10));
        jPanel3.setLayout(new BoxLayout(jPanel3, 1));
        jPanel3.setAlignmentX(0.0f);
        jPanel3.add((Component)serializable);
        jPanel2.add(jPanel3);
        a.a.a.a.d.a.a(jPanel2, String.format("Follow further instructions to %s. Please click the button below to open the url in a browser.\nIf you want you can also click the url below to copy it to the clipboard and paste it into a browser by yourselves", "create Telegram bot and obtain the token"), String.format("https://t.me/%s", a.a.a.a.b.a.a("BotFather")));
        a.a.a.a.d.a.a(jPanel2, String.format("Follow further instructions to %s. Please click the button below to open the url in a browser.\nIf you want you can also click the url below to copy it to the clipboard and paste it into a browser by yourselves", "obtain chat ID"), String.format("https://t.me/%s", a.a.a.a.b.a.a("get_id_bot")));
        a.a.a.a.d.a.a(jPanel2, String.format("Follow further instructions to %s. Please click the button below to open the url in a browser.\nIf you want you can also click the url below to copy it to the clipboard and paste it into a browser by yourselves", "subscribe / start conversation"), String.format("https://t.me/%s", "<bot-username>"), () -> CompletableFuture.supplyAsync(() -> {
            String string = a.a.a.a.a.a(a2, d2.getToken());
            return string.isEmpty() ? "" : String.format("https://t.me/%s?start=subscribe", string);
        }, executorService));
        b b2 = a.a.a.a.b.a(string -> a.a.a.a.d.a.a((JComponent)jPanel2, "Telegram Notifier", string));
        jPanel.setLayout(new GridBagLayout());
        JButton jButton = new JButton();
        jButton.setIcon(q);
        jButton.setPreferredSize(new Dimension(22, 22));
        jButton.addActionListener(actionEvent -> {
            boolean bl = !jPanel2.isVisible();
            jPanel2.setVisible(bl);
            if (bl) {
                jButton.setIcon(r);
            } else {
                jButton.setIcon(q);
            }
        });
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        gridBagConstraints.insets = new Insets(4, 2, 4, 2);
        gridBagConstraints.weightx = 0.0;
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 0;
        gridBagConstraints.anchor = 21;
        jPanel.add((Component)jButton, gridBagConstraints);
        gridBagConstraints.weightx = 1.0;
        gridBagConstraints.anchor = 10;
        gridBagConstraints.gridwidth = 0;
        JButton jButton2 = new JButton("Test");
        jButton2.addActionListener(actionEvent -> {
            String string = String.format("Test message: %s", new Date());
            c c2 = new c(d2.getToken());
            a.a.a.a.a.a.e e2 = new a.a.a.a.a.a.e(c2, d2.getChatId(), string);
            a.a.a.a.a.a(a2, e2, executorService, b2);
        });
        jButton2.setName("Stops&Icebergs On-Chart;telegramTestButton");
        jPanel.add((Component)jButton2, gridBagConstraints);
        return strategyPanel;
    }

    private static /* synthetic */ void b(JPanel jPanel, JButton jButton, ActionEvent actionEvent) {
        boolean bl = !jPanel.isVisible();
        jPanel.setVisible(bl);
        if (bl) {
            jButton.setIcon(r);
        } else {
            jButton.setIcon(q);
        }
    }

    private static /* synthetic */ void c(JPanel jPanel, JButton jButton, ActionEvent actionEvent) {
        boolean bl = !jPanel.isVisible();
        jPanel.setVisible(bl);
        if (bl) {
            jButton.setIcon(r);
        } else {
            jButton.setIcon(q);
        }
    }

    static /* synthetic */ void a(SitIndicator sitIndicator, long l2, boolean bl, boolean bl2) {
        sitIndicator.a(l2, bl, bl2);
    }

    static /* synthetic */ void b(SitIndicator sitIndicator, long l2, boolean bl, boolean bl2) {
        sitIndicator.b(l2, bl, bl2);
    }
}

