/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.Layer1ApiAdminAdapter
 *  velox.api.layer1.Layer1ApiProvider
 *  velox.api.layer1.LayerApiListenable
 *  velox.api.layer1.common.DirectoryResolver
 *  velox.api.layer1.common.ListenableHelper
 *  velox.api.layer1.data.InstrumentInfo
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$PreparedImage
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainter
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainterFactory
 *  velox.api.layer1.messages.Layer1ApiAddonStatisticsEventMessage
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
 *  velox.api.layer1.simplified.TimeListener
 *  velox.api.layer1.simplified.TradeDataListener
 *  velox.gui.StrategyPanel
 */
package velox.indicators.sionchart;

import com.bookmap.addons.common.ui.feedback.g;
import java.awt.Color;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.LayoutManager;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import javax.imageio.ImageIO;
import javax.swing.BoxLayout;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import velox.api.layer1.Layer1ApiAdminAdapter;
import velox.api.layer1.Layer1ApiProvider;
import velox.api.layer1.LayerApiListenable;
import velox.api.layer1.common.DirectoryResolver;
import velox.api.layer1.common.ListenableHelper;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainter;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainterFactory;
import velox.api.layer1.messages.Layer1ApiAddonStatisticsEventMessage;
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
import velox.api.layer1.simplified.TimeListener;
import velox.api.layer1.simplified.TradeDataListener;
import velox.gui.StrategyPanel;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.TelegramSettingsExtended;
import velox.indicators.sionchart.a.a;
import velox.indicators.sionchart.a.b;
import velox.indicators.sionchart.a.c;
import velox.indicators.sionchart.a.d;
import velox.indicators.sionchart.b.i;
import velox.indicators.sionchart.broadcast.BroadcastingApiFacade;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.e_0;
import velox.indicators.sionchart.g_0;
import velox.indicators.sionchart.h;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.l;
import velox.indicators.sionchart.n;
import velox.indicators.sionchart.o;
import velox.indicators.sionchart.p;
import velox.indicators.sionchart.q;
import velox.indicators.sionchart.r;
import velox.indicators.sionchart.s;
import velox.indicators.sionchart.t;
import velox.indicators.sionchart.u;
import velox.indicators.sionchart.v;
import velox.indicators.sionchart.w;

public abstract class m
implements Layer1ApiAdminAdapter,
ScreenSpacePainterFactory,
CustomModuleAdapter,
CustomSettingsPanelProvider,
HistoricalModeListener {
    private static final long B = 60000000000L;
    public static final Color a = new Color(0, 153, 255);
    public static final Color b = new Color(0, 153, 255);
    public static final Color c = new Color(255, 0, 0);
    public static final Color d = new Color(255, 0, 0);
    public final String e;
    private static final String C = "app.properties";
    private static final String D = "version";
    private static final AtomicBoolean E = new AtomicBoolean(false);
    private static int F = 0;
    Api f;
    e g;
    public String h;
    private InstrumentInfo G;
    public w i;
    double j;
    volatile boolean k = false;
    public c l;
    public velox.indicators.sionchart.a.e m;
    public a n;
    private b H;
    private v I;
    protected h o;
    protected e_0 p;
    private final List<Long> J = new ArrayList<Long>();
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> K = new ConcurrentHashMap<OrderEventType, ScreenSpaceCanvas.PreparedImage>();
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> L = new ConcurrentHashMap<OrderEventType, ScreenSpaceCanvas.PreparedImage>();
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> M = new ConcurrentHashMap<OrderEventType, ScreenSpaceCanvas.PreparedImage>();
    final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> q = new ConcurrentHashMap<OrderEventType, ScreenSpaceCanvas.PreparedImage>();
    final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> r = new ConcurrentHashMap<OrderEventType, ScreenSpaceCanvas.PreparedImage>();
    public static final ImageIcon s = new ImageIcon(m.class.getResource("/resources/icons/bottom_panel_show.png"));
    public static final ImageIcon t = new ImageIcon(m.class.getResource("/resources/icons/bottom_panel_hide.png"));
    private long N = 0L;
    private long O = 0L;
    private final ExecutorService P = Executors.newFixedThreadPool(2);
    private final ExecutorService Q = Executors.newFixedThreadPool(2);
    final com.bookmap.addons.common.h.a.a u = com.bookmap.addons.common.h.a.a.a;
    TelegramSettingsExtended v;
    ExecutorService w;
    private BroadcastingApiFacade R;
    protected boolean x;
    public static g y;
    private static com.bookmap.addons.common.ui.feedback.h S;
    private static com.bookmap.addons.common.ui.feedback.d T;
    private static com.bookmap.addons.common.i.a U;
    public final String z;
    public boolean A = false;
    private static com.bookmap.addons.common.e.a V;
    private static long W;

    protected m() {
        Properties properties = new Properties();
        try (InputStream inputStream = m.class.getClassLoader().getResourceAsStream(C);){
            properties.load(inputStream);
        }
        catch (IOException iOException) {
            throw new RuntimeException(iOException);
        }
        this.e = "v." + properties.getProperty(D, "Version not specified");
        this.z = "https://bookmap.com/addons/" + this.f();
        if (W == 0L) {
            W = System.currentTimeMillis();
        }
    }

    public void initialize(String string2, InstrumentInfo instrumentInfo, Api api, InitialState initialState) {
        this.h = string2;
        this.G = instrumentInfo;
        this.k = velox.indicators.sionchart.b.t.a("7.3.0.39", this.e());
        if (this.k) {
            if (!this.a(string2, instrumentInfo)) {
                this.k = false;
                SwingUtilities.invokeLater(() -> {
                    velox.indicators.sionchart.b.l l2 = new velox.indicators.sionchart.b.l("Instrument " + string2 + " is not supported by the " + this.e() + " add-on.<br>For more information you may visit our ", "knowledge base", ".", this.z + "/guide");
                    JOptionPane jOptionPane = new JOptionPane(l2, 1);
                    JDialog jDialog = jOptionPane.createDialog(null, "Instrument type is not supported");
                    jDialog.setModal(false);
                    jDialog.setVisible(true);
                });
            } else {
                try {
                    this.k = TargetedRequestHelper.getSupportedFeaturesForAlias((Layer1ApiProvider)api.getProvider(), (String)string2).mbo;
                }
                catch (Exception exception) {
                    // empty catch block
                }
                if (!this.k) {
                    SwingUtilities.invokeLater(() -> {
                        JLabel jLabel = new JLabel("Instrument " + string2 + " does not provide MBO data. Please check that data aggregation is disabled in the connection configuration.");
                        JOptionPane jOptionPane = new JOptionPane(jLabel, 1);
                        JDialog jDialog = jOptionPane.createDialog(null, "No MBO data");
                        jDialog.setModal(false);
                        jDialog.setVisible(true);
                    });
                }
            }
        }
        if (this.k) {
            this.f = api;
            this.j = instrumentInfo.pips;
            ++F;
            if (U == null) {
                U = new com.bookmap.addons.common.i.a(string -> api.sendUserMessage((Object)Layer1ApiAddonStatisticsEventMessage.createSettingsEventMessage(this.getClass(), (Object)this.c(), (String)string)));
            }
            if (T == null) {
                T = new com.bookmap.addons.common.ui.feedback.d(new com.bookmap.addons.common.ui.feedback.a(U, String.valueOf(DirectoryResolver.getBookmapDirectoryByName((String)"addons").resolve(this.e().toLowerCase(Locale.ROOT).replaceAll(" ", "-")))));
                T.a();
            }
            if (y == null) {
                SwingUtilities.invokeLater(() -> {
                    y = new g(this.e(), this.z + "/survey", this.z + "/guide", this.z + "/community");
                    y.setVisible(false);
                    if (T != null) {
                        T.a(y);
                    }
                });
            }
            this.x = this.a(instrumentInfo);
            this.g = this.c();
            if (!this.x) {
                this.g.showStops = false;
                this.g.stopsAlertEnabled = false;
            }
            this.p = new e_0(this, false);
            velox.indicators.sionchart.b.s s2 = new velox.indicators.sionchart.b.s();
            this.a(s2);
            api.addMarketByOrderDepthDataListeners(velox.indicators.sionchart.b.p.a(s2));
            api.addTradeDataListeners((TradeDataListener)s2);
            api.addTimeListeners((TimeListener)s2);
            api.addDepthDataListeners((DepthDataListener)s2);
            api.addHistoricalModeListeners((HistoricalModeListener)this);
            SwingUtilities.invokeLater(() -> {
                if (this.k) {
                    this.l = new c(this);
                    this.m = new velox.indicators.sionchart.a.e(this);
                    this.i = new w(this);
                    this.n = new a(this);
                    this.H = new b(this, this.x);
                }
            });
            this.K.put(OrderEventType.TRADE, this.b("Iceberg"));
            this.K.put(OrderEventType.DETECTION, this.b("Iceberg"));
            this.K.put(OrderEventType.CANCELLATION, this.b("Iceberg"));
            this.K.put(OrderEventType.EXECUTION, this.b("Iceberg"));
            this.K.put(OrderEventType.ACTIVE, this.b("Iceberg"));
            this.K.put(OrderEventType.STOP, this.b("Stop"));
            this.w = com.bookmap.addons.common.h.a.a();
            this.v = this.g.telegramSettings;
            this.d();
            this.a();
            ListenableHelper.addListeners((LayerApiListenable)api.getProvider(), (Object)this);
            this.R = BroadcastingApiFacade.getInstance(api.getProvider(), this.e(), this.getClass());
            this.R.startAlias(string2, this.g);
            this.R.registerData(string2, this.p, this.o);
            if (V == null) {
                V = new com.bookmap.addons.common.e.a();
                V.a(this.a(api));
            }
        }
    }

    private com.bookmap.addons.common.e.d a(Api api) {
        Consumer<String> consumer = string -> api.sendUserMessage((Object)new Layer1ApiAddonStatisticsEventMessage(this.getClass(), string));
        Consumer<Exception> consumer2 = exception -> {
            throw new RuntimeException((Throwable)exception);
        };
        return new com.bookmap.addons.common.e.d(this.n(), this.o(), this.i(), this.j(), this.k(), this.l(), this.m(), consumer, consumer2, this::a);
    }

    private void a(Boolean bl) {
        this.R.setAvailable(bl);
    }

    public void stop() {
        if (this.k) {
            this.k = false;
            --F;
            this.b();
            if (this.i != null) {
                this.i.a(true);
            }
            if (velox.indicators.sionchart.w.d != null) {
                velox.indicators.sionchart.w.d.dispose();
                velox.indicators.sionchart.w.d = null;
            }
            this.R.stopAlias(this.h);
            if (F == 0) {
                if (T != null) {
                    T.d();
                    T = null;
                }
                if (U != null) {
                    U.a();
                    U = null;
                }
                y = null;
                if (S != null) {
                    S.b();
                    S = null;
                }
                if (V != null) {
                    V.a();
                    V = null;
                }
            }
        }
    }

    public void a(com.bookmap.a.a.a.d d2) {
        this.p.a(d2);
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
        if (this.k) {
            this.I = new v(this.f, screenSpaceCanvasFactory, this.o, this.p, this.J, this.L, this.M, this);
            return this.I;
        }
        return new n(this);
    }

    void a(Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> map, Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> map2, Color color, Color color2) {
        for (Map.Entry<OrderEventType, ScreenSpaceCanvas.PreparedImage> entry : map.entrySet()) {
            BufferedImage bufferedImage = velox.indicators.sionchart.b.i.a(entry.getValue().getReadOnlyImage(), entry.getKey() == OrderEventType.STOP ? color2 : color);
            map2.put(entry.getKey(), new ScreenSpaceCanvas.PreparedImage(bufferedImage));
        }
    }

    private Layer1ApiUserMessageModifyScreenSpacePainter a(String string, boolean bl) {
        String string2 = this.h;
        String string3 = string2.contains("@") ? string2.substring(0, string2.indexOf("@")) : " ";
        o o2 = new o(this, string2, string3);
        return Layer1ApiUserMessageModifyScreenSpacePainter.builder(this.getClass(), (String)string).setIsAdd(bl).setScreenSpacePainterFactory((ScreenSpacePainterFactory)this).setAliasFilter((AliasFilter)o2).build();
    }

    private boolean c(String string) {
        return string.endsWith("@Copy") || string.endsWith("@TM.Pro") || string.endsWith("@TM.Lite");
    }

    public void a() {
        Layer1ApiUserMessageModifyScreenSpacePainter layer1ApiUserMessageModifyScreenSpacePainter = this.a(this.e() + ":" + this.h, true);
        this.f.sendUserMessage((Object)layer1ApiUserMessageModifyScreenSpacePainter);
    }

    public void b() {
        Layer1ApiUserMessageModifyScreenSpacePainter layer1ApiUserMessageModifyScreenSpacePainter = this.a(this.e() + ":" + this.h, false);
        this.f.sendUserMessage((Object)layer1ApiUserMessageModifyScreenSpacePainter);
    }

    public void onRealtimeStart() {
        if (this.k && this.I != null) {
            this.I.onMoveEnd();
        }
    }

    public e c() {
        if (this.g == null) {
            if (this.f != null) {
                this.g = (e)this.f.getSettings(e.class);
                if (this.g.icebergsHiddenTransparency < 30) {
                    this.g.icebergsHiddenTransparency = 30;
                }
                if (this.g.stopsHiddenTransparency < 30) {
                    this.g.stopsHiddenTransparency = 30;
                }
            } else {
                this.g = new e();
            }
        }
        return this.g;
    }

    public void d() {
        e e2 = this.c();
        e2.setHiddenColors();
        this.a(this.K, this.L, e2.icebergsBidColor, e2.stopsBidColor);
        this.a(this.K, this.M, e2.icebergsAskColor, e2.stopsAskColor);
        this.a(this.K, this.q, e2.getIcebergsHiddenBidColor(), e2.getStopsHiddenBidColor());
        this.a(this.K, this.r, e2.getIcebergsHiddenAskColor(), e2.getStopsHiddenAskColor());
        if (this.f != null) {
            this.f.setSettings((Object)e2);
        }
        if (this.I != null) {
            this.I.a();
            this.I.onMoveEnd();
        }
        if (U != null) {
            U.a(this.h, e2);
        }
        if (this.R != null) {
            this.R.updateSettings(this.h, e2);
        }
    }

    public StrategyPanel[] getCustomSettingsPanels() {
        if (this.k) {
            return velox.indicators.sionchart.a.d.a(this, this.f, this.l, this.m, this.i, this.s(), this.n.b(), this.H, this.x);
        }
        if (this.c(this.h)) {
            return this.r();
        }
        return this.q();
    }

    private StrategyPanel[] q() {
        m m2 = (m)this.g();
        m2.h = this.h;
        this.x = this.a(this.G);
        Runnable runnable = () -> {};
        a a2 = new a(m2);
        return velox.indicators.sionchart.a.d.a(m2, null, new c(m2), new velox.indicators.sionchart.a.e(m2), new w(m2), this.a(com.bookmap.addons.common.h.a.a.a, new com.bookmap.addons.common.h.d(), com.bookmap.addons.common.h.a.a(), runnable), a2.b(), new b(m2, this.x), this.x);
    }

    private StrategyPanel[] r() {
        StrategyPanel strategyPanel = new StrategyPanel("Settings for " + this.h);
        strategyPanel.setLayout((LayoutManager)new BoxLayout((Container)strategyPanel, 1));
        JTextArea jTextArea = new JTextArea("To enable and configure the addon for " + this.h + " synthetic instrument use the addon configuration of the original instrument.The name of the synthetic instrument should start with the name of original instrument. Example: ESU4.CME@RITHMIC -> ESU4.CME-123@TM.Pro");
        jTextArea.setLineWrap(true);
        jTextArea.setWrapStyleWord(true);
        strategyPanel.add((Component)jTextArea);
        return new StrategyPanel[]{strategyPanel};
    }

    private StrategyPanel s() {
        Runnable runnable = this::d;
        return this.a(this.u, this.v, this.w, runnable);
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private void a(long l2, boolean bl, boolean bl2) {
        int n2 = 0;
        ArrayList<g_0> arrayList = new ArrayList<g_0>();
        List<g_0> list = this.p.b;
        synchronized (list) {
            for (g_0 g_02 : this.p.b) {
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
                n3 = (int)(d2 + d5 * this.g.stopsAlertSdMultiplier);
                if (n3 > n4) {
                    n3 = n4;
                }
                this.g.stopsAlertThreshold = n3;
            }
            if (!bl || bl2) {
                n3 = (int)(d2 + d5 * this.g.stopsSdMultiplier);
                if (n3 > n4) {
                    n3 = n4;
                }
                this.g.stopsThreshold = n3;
            }
        } else {
            if (bl || bl2) {
                this.g.stopsAlertThreshold = 0;
            }
            if (!bl || bl2) {
                this.g.stopsThreshold = 0;
            }
        }
        SwingUtilities.invokeLater(() -> {
            this.m.d.setValue(this.g.stopsThreshold);
            this.i.f.j.setValue(this.g.stopsAlertThreshold);
            this.I.onMoveEnd();
        });
    }

    public void a(boolean bl) {
        if (this.g.showStops || this.g.stopsAlertEnabled) {
            long l2 = this.f.getProvider().getCurrentTime();
            if (bl || l2 - this.N > 60000000000L) {
                if (this.p.b.size() > 0) {
                    Thread thread;
                    this.N = l2;
                    if (this.g.showStops && this.g.stopsAutoThreshold && this.g.stopsAlertEnabled && this.g.stopsAlertAutoThreshold && this.g.stopsSdInterval == this.g.stopsAlertSdInterval) {
                        p p2 = new p(this, "Calc stops threshold thread", l2);
                        this.P.submit(p2);
                        return;
                    }
                    if (this.g.showStops && this.g.stopsAutoThreshold) {
                        thread = new q(this, "Calc stops threshold thread", l2);
                        this.P.submit(thread);
                    }
                    if (this.g.stopsAlertEnabled && this.g.stopsAlertAutoThreshold) {
                        thread = new r(this, "Calc stops alerts threshold thread", l2);
                        this.P.submit(thread);
                    }
                } else {
                    if (this.g.stopsAutoThreshold) {
                        this.g.stopsThreshold = 0;
                        SwingUtilities.invokeLater(() -> this.m.d.setValue(this.g.stopsThreshold));
                    }
                    if (this.g.stopsAlertAutoThreshold) {
                        this.g.stopsAlertThreshold = 0;
                        SwingUtilities.invokeLater(() -> this.i.f.j.setValue(this.g.stopsAlertThreshold));
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
        Map map = this.o.e;
        synchronized (map) {
            for (l l3 : this.o.e.values()) {
                if (((j)l3.k.get((int)0)).c < l2 || (!this.g.showExecution || ((j)l3.k.get((int)(l3.k.size() - 1))).b != OrderEventType.EXECUTION) && (!this.g.showCancellation || ((j)l3.k.get((int)(l3.k.size() - 1))).b != OrderEventType.CANCELLATION)) continue;
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
                n3 = (int)(d2 + d5 * this.g.icebergsAlertSdMultiplier);
                if (n3 > n4) {
                    n3 = n4;
                }
                this.g.icebergsAlertThreshold = n3;
            }
            if (!bl || bl2) {
                n3 = (int)(d2 + d5 * this.g.icebergsSdMultiplier);
                if (n3 > n4) {
                    n3 = n4;
                }
                this.g.icebergsThreshold = n3;
            }
        } else {
            if (bl || bl2) {
                this.g.icebergsAlertThreshold = 0;
            }
            if (!bl || bl2) {
                this.g.icebergsThreshold = 0;
            }
        }
        SwingUtilities.invokeLater(() -> {
            if (bl || bl2) {
                this.i.e.j.setValue(this.g.icebergsAlertThreshold);
            }
            if (!bl || bl2) {
                this.l.j.setValue(this.g.icebergsThreshold);
            }
            this.I.onMoveEnd();
        });
    }

    public void b(boolean bl) {
        if (this.g.showIcebergs || this.g.icebergsAlertEnabled) {
            long l2 = this.f.getProvider().getCurrentTime();
            if (bl || l2 - this.O > 60000000000L) {
                if (this.o.e.size() > 0) {
                    Thread thread;
                    this.O = l2;
                    if (this.g.showIcebergs && this.g.icebergsAutoThreshold && this.g.icebergsAlertEnabled && this.g.icebergsAlertAutoThreshold && this.g.icebergsSdInterval == this.g.icebergsAlertSdInterval) {
                        s s2 = new s(this, "Calc icebergs threshold thread", l2);
                        this.Q.submit(s2);
                        return;
                    }
                    if (this.g.showIcebergs && this.g.icebergsAutoThreshold) {
                        thread = new t(this, "Calc icebergs threshold thread", l2);
                        this.Q.submit(thread);
                    }
                    if (this.g.icebergsAlertEnabled && this.g.icebergsAlertAutoThreshold) {
                        thread = new u(this, "Calc icebergs alerts threshold thread", l2);
                        this.Q.submit(thread);
                    }
                } else {
                    this.g.icebergsThreshold = 0;
                    SwingUtilities.invokeLater(() -> this.l.j.setValue(this.g.icebergsThreshold));
                }
            }
        }
    }

    public StrategyPanel a(com.bookmap.addons.common.h.a.a a2, com.bookmap.addons.common.h.d d2, ExecutorService executorService, Runnable runnable) {
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
        com.bookmap.addons.common.h.d.a.a(jPanel2, "Token", d2.getToken(), string -> {
            d2.setToken((String)string);
            runnable.run();
        });
        com.bookmap.addons.common.h.d.a.a(jPanel2, "Chat ID", d2.getChatId(), string -> {
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
        com.bookmap.addons.common.h.d.a.a(jPanel2, String.format("Follow further instructions to %s. Please click the button below to open the url in a browser.\nIf you want you can also click the url below to copy it to the clipboard and paste it into a browser by yourselves", "create Telegram bot and obtain the token"), String.format("https://t.me/%s", com.bookmap.addons.common.h.b.a.a("BotFather")));
        com.bookmap.addons.common.h.d.a.a(jPanel2, String.format("Follow further instructions to %s. Please click the button below to open the url in a browser.\nIf you want you can also click the url below to copy it to the clipboard and paste it into a browser by yourselves", "obtain chat ID"), String.format("https://t.me/%s", com.bookmap.addons.common.h.b.a.a("get_id_bot")));
        com.bookmap.addons.common.h.d.a.a(jPanel2, String.format("Follow further instructions to %s. Please click the button below to open the url in a browser.\nIf you want you can also click the url below to copy it to the clipboard and paste it into a browser by yourselves", "subscribe / start conversation"), String.format("https://t.me/%s", "<bot-username>"), () -> CompletableFuture.supplyAsync(() -> {
            String string = com.bookmap.addons.common.h.a.a(a2, d2.getToken());
            return string.isEmpty() ? "" : String.format("https://t.me/%s?start=subscribe", string);
        }, executorService));
        com.bookmap.addons.common.h.b b2 = com.bookmap.addons.common.h.b.a((String string) -> com.bookmap.addons.common.h.d.a.a((JComponent)jPanel2, "Telegram Notifier", string));
        jPanel.setLayout(new GridBagLayout());
        JButton jButton = new JButton();
        jButton.setIcon(s);
        jButton.setPreferredSize(new Dimension(22, 22));
        jButton.addActionListener(actionEvent -> {
            boolean bl = !jPanel2.isVisible();
            jPanel2.setVisible(bl);
            if (bl) {
                jButton.setIcon(t);
            } else {
                jButton.setIcon(s);
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
            com.bookmap.addons.common.h.a.a.c c2 = new com.bookmap.addons.common.h.a.a.c(d2.getToken());
            com.bookmap.addons.common.h.a.a.e e2 = new com.bookmap.addons.common.h.a.a.e(c2, d2.getChatId(), string);
            com.bookmap.addons.common.h.a.a(a2, e2, executorService, b2);
        });
        jButton2.setName(this.e() + ";telegramTestButton");
        jPanel.add((Component)jButton2, gridBagConstraints);
        return strategyPanel;
    }

    public void a(String string) {
        Layer1ApiSoundAlertMessage layer1ApiSoundAlertMessage = Layer1ApiSoundAlertMessage.builder().setTextInfo(string).setSource(this.getClass()).setShowPopup(true).build();
        this.f.getProvider().sendUserMessage((Object)layer1ApiSoundAlertMessage);
    }

    public void onUserMessage(Object object) {
        if (this.k && object instanceof Layer1ApiUserMessageNotification) {
            Layer1ApiUserMessageNotification layer1ApiUserMessageNotification = (Layer1ApiUserMessageNotification)object;
            if (layer1ApiUserMessageNotification.text != null && layer1ApiUserMessageNotification.text.startsWith("Aggregating market data events in order to keep up")) {
                if (System.currentTimeMillis() - W > TimeUnit.SECONDS.toMillis(30L) && E.compareAndSet(false, true)) {
                    SwingUtilities.invokeLater(() -> {
                        velox.indicators.sionchart.b.l l2 = new velox.indicators.sionchart.b.l("The data aggregation mechanism was activated in order to keep up. Note that it seriously<br>affects the " + this.e() + " add-on and may cause wrong detections.<br>For more information you may visit our ", "knowledge base", ".", "https://bookmap.com/addons/" + this.f() + "/guide/data-aggregation");
                        JOptionPane jOptionPane = new JOptionPane(l2, 2);
                        JDialog jDialog = jOptionPane.createDialog(null, "Data aggregation warning");
                        jDialog.setModal(false);
                        jDialog.setVisible(true);
                    });
                }
                this.J.add(this.f.getProvider().getCurrentTime());
            }
        }
    }

    public void a(j j2) {
        this.R.sendEvent(this.h, j2);
    }

    public abstract String e();

    public abstract String f();

    public abstract Object g();

    protected abstract boolean a(String var1, InstrumentInfo var2);

    protected abstract void a(velox.indicators.sionchart.b.s var1);

    protected void h() {
        if (S == null) {
            SwingUtilities.invokeLater(() -> {
                S = new com.bookmap.addons.common.ui.feedback.h(this.e(), this.z + "/survey", this.z + "/guide", this.z + "/community");
                T.a(S);
            });
        }
    }

    protected boolean a(InstrumentInfo instrumentInfo) {
        if (instrumentInfo.type != null) {
            String[] stringArray;
            for (String string : stringArray = instrumentInfo.type.split("@")) {
                if (!"DXFEED".equals(string) && !"EXT:velox.api.layer0.cedrocrystal.Provider".equals(string)) continue;
                return false;
            }
        }
        return true;
    }

    protected abstract byte[] i();

    protected abstract byte[] j();

    protected abstract byte[] k();

    protected abstract byte[] l();

    protected abstract byte[] m();

    protected abstract byte[] n();

    protected abstract byte[] o();

    public void p() {
        if (this.R != null) {
            this.R.updateFilter(this.h, this.g.icebergsThreshold, this.g.stopsThreshold);
        }
    }
}

