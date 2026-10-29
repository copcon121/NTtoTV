/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.Layer1ApiAdminAdapter
 *  velox.api.layer1.Layer1ApiProvider
 *  velox.api.layer1.LayerApiListenable
 *  velox.api.layer1.annotations.Layer1ApiVersion
 *  velox.api.layer1.annotations.Layer1ApiVersionValue
 *  velox.api.layer1.annotations.Layer1SimpleAttachable
 *  velox.api.layer1.annotations.Layer1StrategyDateLicensed
 *  velox.api.layer1.annotations.Layer1StrategyName
 *  velox.api.layer1.common.ListenableHelper
 *  velox.api.layer1.data.InstrumentInfo
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$PreparedImage
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainter
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainterFactory
 *  velox.api.layer1.messages.Layer1ApiSoundAlertMessage
 *  velox.api.layer1.messages.Layer1ApiUserMessageNotification
 *  velox.api.layer1.messages.indicators.AliasFilter
 *  velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyScreenSpacePainter
 *  velox.api.layer1.providers.helper.TargetedRequestHelper
 *  velox.api.layer1.simplified.Api
 *  velox.api.layer1.simplified.CustomModuleAdapter
 *  velox.api.layer1.simplified.CustomSettingsPanelProvider
 *  velox.api.layer1.simplified.DepthDataListener
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
import a.a.a.a.d;
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
import java.io.InputStream;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
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
import velox.api.layer1.Layer1ApiAdminAdapter;
import velox.api.layer1.Layer1ApiProvider;
import velox.api.layer1.LayerApiListenable;
import velox.api.layer1.annotations.Layer1ApiVersion;
import velox.api.layer1.annotations.Layer1ApiVersionValue;
import velox.api.layer1.annotations.Layer1SimpleAttachable;
import velox.api.layer1.annotations.Layer1StrategyDateLicensed;
import velox.api.layer1.annotations.Layer1StrategyName;
import velox.api.layer1.common.ListenableHelper;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainter;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainterFactory;
import velox.api.layer1.messages.Layer1ApiSoundAlertMessage;
import velox.api.layer1.messages.Layer1ApiUserMessageNotification;
import velox.api.layer1.messages.indicators.AliasFilter;
import velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyScreenSpacePainter;
import velox.api.layer1.providers.helper.TargetedRequestHelper;
import velox.api.layer1.simplified.Api;
import velox.api.layer1.simplified.CustomModuleAdapter;
import velox.api.layer1.simplified.CustomSettingsPanelProvider;
import velox.api.layer1.simplified.DepthDataListener;
import velox.api.layer1.simplified.HistoricalModeListener;
import velox.api.layer1.simplified.InitialState;
import velox.api.layer1.simplified.NoAutosubscription;
import velox.api.layer1.simplified.TimeListener;
import velox.api.layer1.simplified.TradeDataListener;
import velox.gui.StrategyPanel;
import velox.gui.utils.GuiUtils;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.TelegramSettingsExtended;
import velox.indicators.sionchart.a;
import velox.indicators.sionchart.b;
import velox.indicators.sionchart.broadcast.Event;
import velox.indicators.sionchart.broadcast.Snapshot;
import velox.indicators.sionchart.broadcast.Subscription;
import velox.indicators.sionchart.broadcast.SubscriptionType;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.e_0;
import velox.indicators.sionchart.f;
import velox.indicators.sionchart.g_0;
import velox.indicators.sionchart.h;
import velox.indicators.sionchart.h_0;
import velox.indicators.sionchart.i;
import velox.indicators.sionchart.i_0;
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
import velox.indicators.sionchart.w;
import velox.indicators.sionchart.x;

@NoAutosubscription
@Layer1SimpleAttachable
@Layer1StrategyName(value="Stops&Icebergs On-Chart")
@Layer1StrategyDateLicensed(value="BM.Indicators.IcebergsTracker")
@Layer1ApiVersion(value=Layer1ApiVersionValue.VERSION2)
public class SitIndicator
implements Layer1ApiAdminAdapter,
ScreenSpacePainterFactory,
CustomModuleAdapter,
CustomSettingsPanelProvider,
HistoricalModeListener {
    public static final String a = "Stops&Icebergs On-Chart";
    public static final String b = "SI On-Chart";
    private static final long A = 60000000000L;
    public static final Color c = new Color(0, 153, 255);
    public static final Color d = new Color(0, 153, 255);
    public static final Color e = new Color(255, 0, 0);
    public static final Color f = new Color(255, 0, 0);
    public static String g;
    private static final String B = "app.properties";
    private static final String C = "version";
    private static final AtomicBoolean D;
    Api h;
    e i;
    String j;
    x k;
    double l;
    volatile boolean m = false;
    private final boolean E = false;
    f n;
    h_0 o;
    a p;
    private b F;
    m q;
    private w G;
    private final h H = new h();
    private i I;
    private e_0 J;
    private final List<Long> K = new ArrayList<Long>();
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> L = new ConcurrentHashMap<OrderEventType, ScreenSpaceCanvas.PreparedImage>();
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> M = new ConcurrentHashMap<OrderEventType, ScreenSpaceCanvas.PreparedImage>();
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> N = new ConcurrentHashMap<OrderEventType, ScreenSpaceCanvas.PreparedImage>();
    final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> r = new ConcurrentHashMap<OrderEventType, ScreenSpaceCanvas.PreparedImage>();
    final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> s = new ConcurrentHashMap<OrderEventType, ScreenSpaceCanvas.PreparedImage>();
    public static final ImageIcon t;
    public static final ImageIcon u;
    private long O = 0L;
    private long P = 0L;
    private final ExecutorService Q = Executors.newFixedThreadPool(2);
    private final ExecutorService R = Executors.newFixedThreadPool(2);
    final a.a.a.a.a.a v = a.a.a.a.a.a.a;
    TelegramSettingsExtended w;
    ExecutorService x;
    final ExecutorService y = Executors.newSingleThreadExecutor();
    final List<i_0> z = Collections.synchronizedList(new LinkedList());

    public SitIndicator() {
        Properties properties = new Properties();
        try (InputStream inputStream = SitIndicator.class.getClassLoader().getResourceAsStream(B);){
            properties.load(inputStream);
        }
        catch (IOException iOException) {
            throw new RuntimeException(iOException);
        }
        g = "v." + properties.getProperty(C, "Version not specified");
    }

    public void initialize(String string, InstrumentInfo instrumentInfo, Api api, InitialState initialState) {
        this.m = velox.indicators.sionchart.a.t.a("7.3.0.26", a);
        if (this.m) {
            if (!string.endsWith("@RITHMIC") && !string.endsWith("@Copy")) {
                this.m = false;
                SwingUtilities.invokeLater(() -> {
                    velox.indicators.sionchart.a.l l2 = new velox.indicators.sionchart.a.l("Instrument " + string + " is not supported by the SI On-Chart addon.<br>For more information you may visit our ", "knowledge base", ".", "https://bookmap.com/knowledgebase/docs/Addons-Stops-And-Icebergs-On-Chart-Indicator");
                    JOptionPane.showMessageDialog(null, l2, "Instrument type is not supported", 1);
                });
            } else {
                try {
                    this.m = TargetedRequestHelper.getSupportedFeaturesForAlias((Layer1ApiProvider)api.getProvider(), (String)string).mbo;
                }
                catch (Exception exception) {
                    // empty catch block
                }
                if (!this.m) {
                    SwingUtilities.invokeLater(() -> {
                        JLabel jLabel = new JLabel("Instrument " + string + " does not provide MBO data. Please check that data aggregation is disabled in the connection configuration.");
                        JOptionPane.showMessageDialog(null, jLabel, "No MBO data", 1);
                    });
                }
            }
        }
        if (this.m) {
            this.h = api;
            this.j = string;
            this.l = instrumentInfo.pips;
            this.i = this.e();
            this.I = new i(this);
            this.J = new e_0(this, false);
            a.a.b.a.a.a a2 = new a.a.b.a.a.a();
            a2.a(this::a);
            a2.b(this::a);
            velox.indicators.sionchart.a.s s2 = new velox.indicators.sionchart.a.s();
            s2.b.addAll(Arrays.asList(this.H, this.I, a2, this.J));
            s2.c.addAll(Arrays.asList(this.H, this.I, a2, this.J));
            s2.a.addAll(Arrays.asList(this.H, this.I, this.J));
            s2.d.add(a2);
            api.addMarketByOrderDepthDataListeners(velox.indicators.sionchart.a.p.a(s2));
            api.addTradeDataListeners((TradeDataListener)s2);
            api.addTimeListeners((TimeListener)s2);
            api.addDepthDataListeners((DepthDataListener)s2);
            api.addHistoricalModeListeners((HistoricalModeListener)this);
            SwingUtilities.invokeLater(() -> {
                this.n = new f(this);
                this.o = new h_0(this);
                this.k = new x(this);
                this.p = new a(this);
                this.F = new b(this);
                this.q = new m(this);
            });
            this.L.put(OrderEventType.TRADE, this.c("Iceberg"));
            this.L.put(OrderEventType.DETECTION, this.c("Iceberg"));
            this.L.put(OrderEventType.CANCELLATION, this.c("Iceberg"));
            this.L.put(OrderEventType.EXECUTION, this.c("Iceberg"));
            this.L.put(OrderEventType.ACTIVE, this.c("Iceberg"));
            this.L.put(OrderEventType.STOP, this.c("Stop"));
            this.x = a.a.a.a.a.a();
            this.w = this.i.telegramSettings;
            this.f();
            this.c();
            ListenableHelper.addListeners((LayerApiListenable)api.getProvider(), (Object)this);
            this.a();
        }
    }

    public void a() {
    }

    public void stop() {
        if (this.m) {
            this.m = false;
            this.d();
            if (this.k != null) {
                this.k.a(true);
            }
            if (velox.indicators.sionchart.x.c != null) {
                velox.indicators.sionchart.x.c.dispose();
                velox.indicators.sionchart.x.c = null;
            }
            this.b();
        }
    }

    public void b() {
    }

    public void a(String string) {
        l l2 = (l)this.H.c.get(string);
        if (l2 != null) {
            this.I.a(l2);
        }
    }

    public void a(a.a.b.a.a.b b2) {
        this.J.a(b2);
    }

    private ScreenSpaceCanvas.PreparedImage c(String string) {
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
        if (this.m && string.endsWith(":" + string2)) {
            this.G = new w(this.h, screenSpaceCanvasFactory, this.I, this.J, this.K, this.M, this.N, this);
            return this.G;
        }
        throw new RuntimeException("Trying to create ScreenSpacePainter on alias " + this.j + " for alias " + string2);
    }

    void a(Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> map, Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> map2, Color color, Color color2) {
        for (Map.Entry<OrderEventType, ScreenSpaceCanvas.PreparedImage> entry : map.entrySet()) {
            BufferedImage bufferedImage = velox.indicators.sionchart.a.i.a(entry.getValue().getReadOnlyImage(), entry.getKey() == OrderEventType.STOP ? color2 : color);
            map2.put(entry.getKey(), new ScreenSpaceCanvas.PreparedImage(bufferedImage));
        }
    }

    private Layer1ApiUserMessageModifyScreenSpacePainter a(String string, boolean bl) {
        String string2 = this.j;
        n n2 = new n(this, string2);
        return Layer1ApiUserMessageModifyScreenSpacePainter.builder(SitIndicator.class, (String)string).setIsAdd(bl).setScreenSpacePainterFactory((ScreenSpacePainterFactory)this).setAliasFilter((AliasFilter)n2).build();
    }

    public void c() {
        Layer1ApiUserMessageModifyScreenSpacePainter layer1ApiUserMessageModifyScreenSpacePainter = this.a("Stops&Icebergs On-Chart:" + this.j, true);
        this.h.sendUserMessage((Object)layer1ApiUserMessageModifyScreenSpacePainter);
    }

    public void d() {
        Layer1ApiUserMessageModifyScreenSpacePainter layer1ApiUserMessageModifyScreenSpacePainter = this.a("Stops&Icebergs On-Chart:" + this.j, false);
        this.h.sendUserMessage((Object)layer1ApiUserMessageModifyScreenSpacePainter);
    }

    public void onRealtimeStart() {
        if (this.m && this.G != null) {
            this.G.onMoveEnd();
        }
    }

    protected e e() {
        if (this.i == null) {
            if (this.h != null) {
                this.i = (e)this.h.getSettings(e.class);
                if (this.i.icebergsHiddenTransparency < 30) {
                    this.i.icebergsHiddenTransparency = 30;
                }
                if (this.i.stopsHiddenTransparency < 30) {
                    this.i.stopsHiddenTransparency = 30;
                }
            } else {
                this.i = new e();
            }
        }
        return this.i;
    }

    protected void f() {
        e e2 = this.e();
        e2.setHiddenColors();
        this.a(this.L, this.M, e2.icebergsBidColor, e2.stopsBidColor);
        this.a(this.L, this.N, e2.icebergsAskColor, e2.stopsAskColor);
        this.a(this.L, this.r, e2.getIcebergsHiddenBidColor(), e2.getStopsHiddenBidColor());
        this.a(this.L, this.s, e2.getIcebergsHiddenAskColor(), e2.getStopsHiddenAskColor());
        if (this.h != null) {
            this.h.setSettings((Object)e2);
        }
        if (this.G != null) {
            this.G.a();
            this.G.onMoveEnd();
        }
    }

    public StrategyPanel[] getCustomSettingsPanels() {
        if (this.m) {
            return SitIndicator.a(this.h, this.n, this.o, this.k, this.g(), this.p.b(), this.F, this.q);
        }
        return SitIndicator.getCustomDisabledSettingsPanels();
    }

    private static StrategyPanel[] a(Api api, f f2, h_0 h_02, x x2, StrategyPanel strategyPanel, StrategyPanel strategyPanel2, b b2, StrategyPanel strategyPanel3) {
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
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.w, "Sets automatic size threshold based on the current settings"), serializable);
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
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.v, "Apply size threshold to active (partially filled) icebergs"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new JSeparator(0), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.x, "Show the icons filtered out by the filters"), serializable);
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
        jPanel.add((Component)f2.m, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)f2.p, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)f2.q, serializable);
        ++((GridBagConstraints)serializable).gridy;
        ((GridBagConstraints)serializable).gridwidth = 0;
        jPanel.add((Component)new JSeparator(0), serializable);
        ((GridBagConstraints)serializable).gridwidth = -1;
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)f2.s, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)f2.r, serializable);
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
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.z, "Disable icons aggregation"), serializable);
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
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.k, "Filter applied after aggregation"), serializable);
        ((GridBagConstraints)serializable).gridy += 2;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.j, "<html>Only orders which total traded size is more or equal to  <br>the selected value would be indicated on the screen</html>"), serializable);
        ((GridBagConstraints)serializable).gridy += 2;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.A, "Sets the time interval (moving window) to calculate the standard deviation on"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.B, "Sets the standard deviation multiplier. The higher the value is - the higher is the threshold"), serializable);
        ((GridBagConstraints)serializable).gridy += 5;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.C, "Transparency of the icons filtered out by the aggregated filter"), serializable);
        ((GridBagConstraints)serializable).gridy += 2;
        jPanel.add((Component)f2.n, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)f2.o, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)f2.y, serializable);
        ((GridBagConstraints)serializable).gridy += 2;
        jPanel.add((Component)f2.t, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)f2.u, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)f2.h, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)f2.i, serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.b, "Sets the icons size"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.c, "Sets the length of the icons offset lines"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.d, "Sets the order line width"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.e, "Sets the icons offset lines width"), serializable);
        ((GridBagConstraints)serializable).gridy += 3;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.f, "Sets the vertical size of the area to be aggregated in the icon heights"), serializable);
        ++((GridBagConstraints)serializable).gridy;
        jPanel.add((Component)new velox.indicators.sionchart.a.k(f2.g, "Sets the horizontal size of the area to be aggregated in the icon widths"), serializable);
        serializable = new JPanel();
        ((Container)serializable).setLayout(new GridBagLayout());
        jComponent = new JButton();
        ((AbstractButton)jComponent).setIcon(t);
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
        ((Container)serializable).add(f2.l, serializable2);
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
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.r, "Sets automatic size threshold based on the current settings"), serializable3);
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
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.f, "Show only stop chains executed on multiple price levels"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new JSeparator(0), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.j, "Show the icons filtered out by the filters"), serializable3);
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
        ((Container)serializable2).add(h_02.h, serializable3);
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
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.k, "Disable icons aggregation"), serializable3);
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
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.e, "Filter applied after aggregation"), serializable3);
        ((GridBagConstraints)serializable3).gridy += 2;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.d, "<html>Only stop chains which total traded size is more or equal <br>to the selected value would be indicated on the screen</html>"), serializable3);
        ((GridBagConstraints)serializable3).gridy += 2;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.s, "Sets the time interval (moving window) to calculate the standard deviation on"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.t, "Sets the standard deviation multiplier. The higher the value is - the higher is the threshold"), serializable3);
        ((GridBagConstraints)serializable3).gridy += 5;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.u, "Transparency of the icons filtered out by the aggregated filter"), serializable3);
        ((GridBagConstraints)serializable3).gridy += 2;
        ((Container)serializable2).add(h_02.i, serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add((Component)h_02.b, serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add((Component)h_02.c, serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.l, "Sets the icons size"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.m, "Sets the length of the icons offset lines"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.n, "Sets the order line width"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.o, "Sets the icons offset lines width"), serializable3);
        ((GridBagConstraints)serializable3).gridy += 3;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.p, "Sets the vertical size of the area to be aggregated in the icon heights"), serializable3);
        ++((GridBagConstraints)serializable3).gridy;
        ((Container)serializable2).add(new velox.indicators.sionchart.a.k(h_02.q, "Sets the horizontal size of the area to be aggregated in the icon widths"), serializable3);
        serializable3 = new JPanel();
        ((Container)serializable3).setLayout(new GridBagLayout());
        jComponent2 = new JButton();
        ((AbstractButton)jComponent2).setIcon(t);
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
        ((Container)serializable3).add(h_02.g, serializable4);
        jComponent2 = new StrategyPanel("Stops visual settings");
        jComponent2.setLayout(new BoxLayout(jComponent2, 1));
        jComponent2.add((Component)serializable3);
        jComponent2.add((Component)serializable2);
        strategyPanel3.setVisible(true);
        serializable4 = new StrategyPanel("Reset settings");
        serializable4.setLayout(new GridBagLayout());
        serializable4.add(b2.a);
        jLabel = new StrategyPanel(null);
        jLabel.setLayout(new BorderLayout());
        jLabel.add(new JLabel("Stops&Icebergs On-Chart " + g), "East");
        strategyPanelArray = new StrategyPanel[]{jComponent, x2.d, jComponent2, x2.e, strategyPanel3, strategyPanel, strategyPanel2, serializable4, jLabel};
        if (api == null) {
            for (StrategyPanel strategyPanel4 : strategyPanelArray) {
                GuiUtils.setPanelEnabled((JPanel)strategyPanel4, (Boolean)false);
            }
        }
        return strategyPanelArray;
    }

    public static StrategyPanel[] getCustomDisabledSettingsPanels() {
        SitIndicator sitIndicator = new SitIndicator();
        Runnable runnable = () -> {};
        a a2 = new a(sitIndicator);
        return SitIndicator.a(null, new f(sitIndicator), new h_0(sitIndicator), new x(sitIndicator), SitIndicator.a(a.a.a.a.a.a.a, new d(), a.a.a.a.a.a(), runnable), a2.b(), new b(sitIndicator), new m(sitIndicator));
    }

    private StrategyPanel g() {
        Runnable runnable = this::f;
        return SitIndicator.a(this.v, this.w, this.x, runnable);
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private void a(long l2, boolean bl, boolean bl2) {
        int n2 = 0;
        ArrayList<g_0> arrayList = new ArrayList<g_0>();
        List<g_0> list = this.J.b;
        synchronized (list) {
            for (g_0 g_02 : this.J.b) {
                if (g_02.a.get((int)0).c < l2) continue;
                arrayList.add(g_02);
            }
        }
        if (arrayList.size() > 0) {
            int n3;
            int n4 = 0;
            for (g_0 g_02 : arrayList) {
                n2 += g_02.b;
                if (g_02.b <= n4) continue;
                n4 = g_02.b;
            }
            double d2 = (double)n2 / (double)arrayList.size();
            double d3 = 0.0;
            for (g_0 g_03 : arrayList) {
                d3 += Math.pow((double)g_03.b - d2, 2.0);
            }
            double d4 = d3 / (double)arrayList.size();
            double d5 = Math.sqrt(d4);
            if (bl || bl2) {
                n3 = (int)(d2 + d5 * this.i.stopsAlertSdMultiplier);
                if (n3 > n4) {
                    n3 = n4;
                }
                this.i.stopsAlertThreshold = n3;
            }
            if (!bl || bl2) {
                n3 = (int)(d2 + d5 * this.i.stopsSdMultiplier);
                if (n3 > n4) {
                    n3 = n4;
                }
                this.i.stopsThreshold = n3;
            }
        } else {
            if (bl || bl2) {
                this.i.stopsAlertThreshold = 0;
            }
            if (!bl || bl2) {
                this.i.stopsThreshold = 0;
            }
        }
        SwingUtilities.invokeLater(() -> {
            this.o.d.setValue(this.i.stopsThreshold);
            this.k.e.i.setValue(this.i.stopsAlertThreshold);
            this.G.onMoveEnd();
        });
    }

    public void a(boolean bl) {
        if (this.i.showStops || this.i.stopsAlertEnabled) {
            long l2 = this.h.getProvider().getCurrentTime();
            if (bl || l2 - this.O > 60000000000L) {
                if (this.J.b.size() > 0) {
                    Thread thread;
                    this.O = l2;
                    if (this.i.showStops && this.i.stopsAutoThreshold && this.i.stopsAlertEnabled && this.i.stopsAlertAutoThreshold && this.i.stopsSdInterval == this.i.stopsAlertSdInterval) {
                        o o2 = new o(this, "Calc stops threshold thread", l2);
                        this.Q.submit(o2);
                        return;
                    }
                    if (this.i.showStops && this.i.stopsAutoThreshold) {
                        thread = new p(this, "Calc stops threshold thread", l2);
                        this.Q.submit(thread);
                    }
                    if (this.i.stopsAlertEnabled && this.i.stopsAlertAutoThreshold) {
                        thread = new q(this, "Calc stops alerts threshold thread", l2);
                        this.Q.submit(thread);
                    }
                } else {
                    if (this.i.stopsAutoThreshold) {
                        this.i.stopsThreshold = 0;
                        SwingUtilities.invokeLater(() -> this.o.d.setValue(this.i.stopsThreshold));
                    }
                    if (this.i.stopsAlertAutoThreshold) {
                        this.i.stopsAlertThreshold = 0;
                        SwingUtilities.invokeLater(() -> this.k.e.i.setValue(this.i.stopsAlertThreshold));
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
        Map map = this.I.c;
        synchronized (map) {
            for (l l3 : this.I.c.values()) {
                if (((k)l3.l.get((int)0)).c < l2 || (!this.i.showExecution || ((k)l3.l.get((int)(l3.l.size() - 1))).b != OrderEventType.EXECUTION) && (!this.i.showCancellation || ((k)l3.l.get((int)(l3.l.size() - 1))).b != OrderEventType.CANCELLATION)) continue;
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
                n3 = (int)(d2 + d5 * this.i.icebergsAlertSdMultiplier);
                if (n3 > n4) {
                    n3 = n4;
                }
                this.i.icebergsAlertThreshold = n3;
            }
            if (!bl || bl2) {
                n3 = (int)(d2 + d5 * this.i.icebergsSdMultiplier);
                if (n3 > n4) {
                    n3 = n4;
                }
                this.i.icebergsThreshold = n3;
            }
        } else {
            if (bl || bl2) {
                this.i.icebergsAlertThreshold = 0;
            }
            if (!bl || bl2) {
                this.i.icebergsThreshold = 0;
            }
        }
        SwingUtilities.invokeLater(() -> {
            if (bl || bl2) {
                this.k.d.i.setValue(this.i.icebergsAlertThreshold);
            }
            if (!bl || bl2) {
                this.n.j.setValue(this.i.icebergsThreshold);
            }
            this.G.onMoveEnd();
        });
    }

    public void b(boolean bl) {
        if (this.i.showIcebergs || this.i.icebergsAlertEnabled) {
            long l2 = this.h.getProvider().getCurrentTime();
            if (bl || l2 - this.P > 60000000000L) {
                if (this.I.c.size() > 0) {
                    Thread thread;
                    this.P = l2;
                    if (this.i.showIcebergs && this.i.icebergsAutoThreshold && this.i.icebergsAlertEnabled && this.i.icebergsAlertAutoThreshold && this.i.icebergsSdInterval == this.i.icebergsAlertSdInterval) {
                        r r2 = new r(this, "Calc icebergs threshold thread", l2);
                        this.R.submit(r2);
                        return;
                    }
                    if (this.i.showIcebergs && this.i.icebergsAutoThreshold) {
                        thread = new s(this, "Calc icebergs threshold thread", l2);
                        this.R.submit(thread);
                    }
                    if (this.i.icebergsAlertEnabled && this.i.icebergsAlertAutoThreshold) {
                        thread = new t(this, "Calc icebergs alerts threshold thread", l2);
                        this.R.submit(thread);
                    }
                } else {
                    this.i.icebergsThreshold = 0;
                    SwingUtilities.invokeLater(() -> this.n.j.setValue(this.i.icebergsThreshold));
                }
            }
        }
    }

    public static StrategyPanel a(a.a.a.a.a.a a2, d d2, ExecutorService executorService, Runnable runnable) {
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
        a.a.a.a.b b2 = a.a.a.a.b.a(string -> a.a.a.a.d.a.a((JComponent)jPanel2, "Telegram Notifier", string));
        jPanel.setLayout(new GridBagLayout());
        JButton jButton = new JButton();
        jButton.setIcon(t);
        jButton.setPreferredSize(new Dimension(22, 22));
        jButton.addActionListener(actionEvent -> {
            boolean bl = !jPanel2.isVisible();
            jPanel2.setVisible(bl);
            if (bl) {
                jButton.setIcon(u);
            } else {
                jButton.setIcon(t);
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

    public void b(String string) {
        Layer1ApiSoundAlertMessage layer1ApiSoundAlertMessage = Layer1ApiSoundAlertMessage.builder().setTextInfo(string).setSource(SitIndicator.class).setShowPopup(true).build();
        this.h.getProvider().sendUserMessage((Object)layer1ApiSoundAlertMessage);
    }

    public void onUserMessage(Object object) {
        if (this.m && object instanceof Layer1ApiUserMessageNotification) {
            Layer1ApiUserMessageNotification layer1ApiUserMessageNotification = (Layer1ApiUserMessageNotification)object;
            if (layer1ApiUserMessageNotification.text != null && layer1ApiUserMessageNotification.text.startsWith("Aggregating market data events in order to keep up")) {
                if (D.compareAndSet(false, true)) {
                    SwingUtilities.invokeLater(() -> {
                        velox.indicators.sionchart.a.l l2 = new velox.indicators.sionchart.a.l("The data aggregation mechanism was activated in order to keep up. Note that it seriously<br>affects the SI On-Chart add-on and may cause wrong detections.<br>For more information you may visit our ", "knowledge base", ".", "https://bookmap.com/addons/si-on-chart/guide/data-aggregation");
                        JOptionPane.showMessageDialog(null, l2, "Data aggregation warning", 2);
                    });
                }
                this.K.add(this.h.getProvider().getCurrentTime());
            }
        }
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private Snapshot a(i_0 i_02) {
        List<g_0> list;
        ArrayList<Event> arrayList = new ArrayList<Event>();
        if (i_02.a.type == SubscriptionType.ALL || i_02.a.type == SubscriptionType.ICEBERGS) {
            list = this.I.e;
            synchronized (list) {
                List list2 = this.I.d;
                synchronized (list2) {
                    this.z.add(new i_0(new Subscription(i_02.a.subscriber, this.j, SubscriptionType.ICEBERGS), i_02.b, i_02.c));
                    for (Object object : this.I.e) {
                        arrayList.add(new Event(((k)object).a.f, ((k)object).b, ((k)object).c, ((k)object).d, ((k)object).e, ((k)object).a.g, ((k)object).f));
                    }
                    for (Object object : this.I.d) {
                        arrayList.add(new Event(((k)object).a.f, ((k)object).b, ((k)object).c, ((k)object).d, ((k)object).e, ((k)object).a.g, ((k)object).f));
                    }
                }
            }
        }
        if (i_02.a.type == SubscriptionType.ALL || i_02.a.type == SubscriptionType.STOPS) {
            list = this.J.b;
            synchronized (list) {
                this.z.add(new i_0(new Subscription(i_02.a.subscriber, this.j, SubscriptionType.STOPS), i_02.b, i_02.c));
                for (g_0 g_02 : this.J.b) {
                    Object object;
                    if (g_02.b < this.i.stopsThreshold || this.i.showOnlyStopsTBPL && !g_02.c()) continue;
                    object = g_02.a;
                    synchronized (object) {
                        for (k k2 : g_02.a) {
                            arrayList.add(new Event(k2.a.f, k2.b, k2.c, k2.d, k2.e, k2.a.g, k2.f));
                        }
                    }
                }
            }
        }
        return new Snapshot(arrayList, this.j, i_02.a.type);
    }

    private void b(i_0 i_02) {
        u u2 = new u(this, "Send snapshot", i_02);
        this.y.submit(u2);
    }

    public void a(k k2) {
        if (!this.z.isEmpty()) {
            // empty if block
        }
    }

    private static /* synthetic */ boolean a(Subscription subscription, i_0 i_02) {
        return i_02.a.subscriber.equals(subscription.subscriber) && (subscription.type == SubscriptionType.ALL || i_02.a.type == subscription.type);
    }

    private static /* synthetic */ void b(JPanel jPanel, JButton jButton, ActionEvent actionEvent) {
        boolean bl = !jPanel.isVisible();
        jPanel.setVisible(bl);
        if (bl) {
            jButton.setIcon(u);
        } else {
            jButton.setIcon(t);
        }
    }

    private static /* synthetic */ void c(JPanel jPanel, JButton jButton, ActionEvent actionEvent) {
        boolean bl = !jPanel.isVisible();
        jPanel.setVisible(bl);
        if (bl) {
            jButton.setIcon(u);
        } else {
            jButton.setIcon(t);
        }
    }

    static {
        D = new AtomicBoolean(false);
        t = new ImageIcon(SitIndicator.class.getResource("/resources/icons/bottom_panel_show.png"));
        u = new ImageIcon(SitIndicator.class.getResource("/resources/icons/bottom_panel_hide.png"));
    }
}

