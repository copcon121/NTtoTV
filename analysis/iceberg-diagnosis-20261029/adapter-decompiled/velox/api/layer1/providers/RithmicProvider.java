/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  com.google.common.primitives.Longs
 *  org.apache.commons.collections4.IterableUtils
 *  org.apache.commons.lang3.ArrayUtils
 *  org.apache.commons.lang3.ObjectUtils
 *  org.apache.commons.lang3.StringUtils
 *  org.apache.commons.lang3.tuple.Pair
 *  velox.api.layer0.annotations.Layer0CredentialsFieldsManager
 *  velox.api.layer0.annotations.Layer0DateLicensed
 *  velox.api.layer0.credentialscomponents.CredentialsSerializationField
 *  velox.api.layer1.Layer1ApiAdminListener
 *  velox.api.layer1.Layer1ApiDataListener
 *  velox.api.layer1.Layer1ApiInstrumentListener
 *  velox.api.layer1.Layer1ApiMboDataListener
 *  velox.api.layer1.Layer1ApiProvider
 *  velox.api.layer1.Layer1ApiTradingListener
 *  velox.api.layer1.annotations.MaximumSupportedFeatures
 *  velox.api.layer1.common.Log
 *  velox.api.layer1.data.AccountInfo
 *  velox.api.layer1.data.BracketTier
 *  velox.api.layer1.data.CrossTradingStatus
 *  velox.api.layer1.data.DisconnectionReason
 *  velox.api.layer1.data.ExecutionInfo
 *  velox.api.layer1.data.ExtendedLoginData
 *  velox.api.layer1.data.InstrumentInfo
 *  velox.api.layer1.data.Layer1ApiProviderSupportedFeatures
 *  velox.api.layer1.data.Layer1ApiProviderSupportedFeaturesBuilder
 *  velox.api.layer1.data.LoginData
 *  velox.api.layer1.data.LoginFailedReason
 *  velox.api.layer1.data.MarketMode
 *  velox.api.layer1.data.OcoOrderSendParameters
 *  velox.api.layer1.data.OrderCancelParameters
 *  velox.api.layer1.data.OrderDuration
 *  velox.api.layer1.data.OrderInfoBuilder
 *  velox.api.layer1.data.OrderInfoUpdate
 *  velox.api.layer1.data.OrderMoveParameters
 *  velox.api.layer1.data.OrderMoveToMarketParameters
 *  velox.api.layer1.data.OrderResizeParameters
 *  velox.api.layer1.data.OrderSendParameters
 *  velox.api.layer1.data.OrderStatus
 *  velox.api.layer1.data.OrderType
 *  velox.api.layer1.data.OrderUpdateParameters
 *  velox.api.layer1.data.OsoOrderSendParameters
 *  velox.api.layer1.data.SimpleOrderSendParameters
 *  velox.api.layer1.data.StatusInfo
 *  velox.api.layer1.data.StatusInfoBuilder
 *  velox.api.layer1.data.SubscribeInfo
 *  velox.api.layer1.data.SystemTextMessageType
 *  velox.api.layer1.messages.CrossTradingStatusMessage
 *  velox.api.layer1.messages.Layer1ApiIgnorableUpwardMessage
 *  velox.api.layer1.messages.Layer1ApiIsRealTradingMessage
 *  velox.api.layer1.messages.Layer1ApiPositionCloseCompleteMessage
 *  velox.api.layer1.messages.Layer1ApiTimeFreeze
 *  velox.api.layer1.messages.Layer1ApiUserMessageNotification
 *  velox.api.layer1.messages.SelectAccountMessage
 *  velox.api.layer1.messages.historicalserver.Layer1ApiRestartHistoricalServer
 *  velox.api.layer1.providers.WorkingOrdersCounter
 *  velox.api.layer1.reading.UserDataUserMessage
 *  velox.api.layer1.settings.Layer1UserLicenseFieldsInterface
 *  velox.api.layer1.utils.PerformanceLoggingHelper
 */
package velox.api.layer1.providers;

import com.google.common.primitives.Longs;
import java.lang.reflect.InvocationTargetException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.SortedMap;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.apache.commons.collections4.IterableUtils;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.tuple.Pair;
import velox.api.layer0.annotations.Layer0CredentialsFieldsManager;
import velox.api.layer0.annotations.Layer0DateLicensed;
import velox.api.layer0.credentialscomponents.CredentialsSerializationField;
import velox.api.layer1.Layer1ApiAdminListener;
import velox.api.layer1.Layer1ApiDataListener;
import velox.api.layer1.Layer1ApiInstrumentListener;
import velox.api.layer1.Layer1ApiMboDataListener;
import velox.api.layer1.Layer1ApiProvider;
import velox.api.layer1.Layer1ApiTradingListener;
import velox.api.layer1.annotations.MaximumSupportedFeatures;
import velox.api.layer1.common.Log;
import velox.api.layer1.data.AccountInfo;
import velox.api.layer1.data.BracketTier;
import velox.api.layer1.data.CrossTradingStatus;
import velox.api.layer1.data.DisconnectionReason;
import velox.api.layer1.data.ExecutionInfo;
import velox.api.layer1.data.ExtendedLoginData;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.data.Layer1ApiProviderSupportedFeatures;
import velox.api.layer1.data.Layer1ApiProviderSupportedFeaturesBuilder;
import velox.api.layer1.data.LoginData;
import velox.api.layer1.data.LoginFailedReason;
import velox.api.layer1.data.MarketMode;
import velox.api.layer1.data.OcoOrderSendParameters;
import velox.api.layer1.data.OrderCancelParameters;
import velox.api.layer1.data.OrderDuration;
import velox.api.layer1.data.OrderInfoBuilder;
import velox.api.layer1.data.OrderInfoUpdate;
import velox.api.layer1.data.OrderMoveParameters;
import velox.api.layer1.data.OrderMoveToMarketParameters;
import velox.api.layer1.data.OrderResizeParameters;
import velox.api.layer1.data.OrderSendParameters;
import velox.api.layer1.data.OrderStatus;
import velox.api.layer1.data.OrderType;
import velox.api.layer1.data.OrderUpdateParameters;
import velox.api.layer1.data.OsoOrderSendParameters;
import velox.api.layer1.data.SimpleOrderSendParameters;
import velox.api.layer1.data.StatusInfo;
import velox.api.layer1.data.StatusInfoBuilder;
import velox.api.layer1.data.SubscribeInfo;
import velox.api.layer1.data.SystemTextMessageType;
import velox.api.layer1.messages.CrossTradingStatusMessage;
import velox.api.layer1.messages.Layer1ApiIgnorableUpwardMessage;
import velox.api.layer1.messages.Layer1ApiIsRealTradingMessage;
import velox.api.layer1.messages.Layer1ApiPositionCloseCompleteMessage;
import velox.api.layer1.messages.Layer1ApiTimeFreeze;
import velox.api.layer1.messages.Layer1ApiUserMessageNotification;
import velox.api.layer1.messages.SelectAccountMessage;
import velox.api.layer1.messages.historicalserver.Layer1ApiRestartHistoricalServer;
import velox.api.layer1.providers.C;
import velox.api.layer1.providers.D;
import velox.api.layer1.providers.RithmicFieldManager;
import velox.api.layer1.providers.WorkingOrdersCounter;
import velox.api.layer1.reading.UserDataUserMessage;
import velox.api.layer1.settings.Layer1UserLicenseFieldsInterface;
import velox.api.layer1.utils.PerformanceLoggingHelper;
import velox.bookmap.ep;
import velox.bookmap.eq;
import velox.rithmic.IRithmicListener;

@Layer0CredentialsFieldsManager(value=RithmicFieldManager.class)
@Layer0DateLicensed(value="Rithmic")
public class RithmicProvider
extends C
implements Layer1UserLicenseFieldsInterface,
IRithmicListener {
    private static final Set<String> e = new HashSet<String>(Arrays.asList("EUREX"));
    private static final long f = TimeUnit.SECONDS.toNanos(15L);
    private static final boolean g = "true".equals(System.getProperty(RithmicProvider.class.getName() + ".SEND_ORDER_PRIORITY"));
    private static final boolean h = "true".equals(System.getProperty(RithmicProvider.class.getName() + ".SEND_TIMESTAMPS"));
    private static final long i = Layer1ApiUserMessageNotification.getNextId();
    private static final Set<OrderStatus> j = new HashSet<OrderStatus>(Arrays.asList(OrderStatus.CANCELLED, OrderStatus.FILLED, OrderStatus.REJECTED));
    private static final ExecutorService k = RithmicProvider.d();
    protected final Map<String, b> c = new ConcurrentHashMap<String, b>();
    private final HashMap<String, StatusInfoBuilder> l = new HashMap();
    private final HashMap<String, String> m = new HashMap();
    private final HashMap<String, String> n = new HashMap();
    private final boolean o;
    private Future<?> p;
    private volatile velox.rithmic.RithmicProvider q = null;
    private final a r = new a(this::b, () -> this.q.getPendingMarketDataConnectionInputSize());
    private String s = null;
    private String t = null;
    private boolean u = false;
    private boolean v = false;
    private boolean w = false;
    private final AtomicBoolean x = new AtomicBoolean(false);
    private final AtomicBoolean y = new AtomicBoolean(false);
    private boolean z = false;
    private boolean A = false;

    private static ExecutorService d() {
        D d2 = new D();
        return new ThreadPoolExecutor(0, 1, 1L, TimeUnit.MINUTES, new LinkedBlockingQueue<Runnable>(), d2);
    }

    public RithmicProvider() {
        this(h);
    }

    public RithmicProvider(boolean bl) {
        this.o = bl;
    }

    @Override
    protected String a(String string, String string2) {
        Object object = string2 + "." + string;
        object = ((String)object).toUpperCase();
        this.m.put((String)object, string);
        this.n.put((String)object, string2);
        return object;
    }

    private String a(String string) {
        return this.m.get(string);
    }

    private String b(String string) {
        return this.n.get(string);
    }

    public void subscribe(SubscribeInfo subscribeInfo) {
        String string = subscribeInfo.symbol;
        String string2 = subscribeInfo.exchange;
        String string3 = subscribeInfo.type;
        Log.info((String)String.format("Subscribing to %s, %s, %s.", string, string2, string3));
        String string4 = this.a(string2, string);
        C.a a2 = this.c.get(string4);
        if (a2 == null || !a2.b) {
            if (string.isEmpty() || string2.isEmpty()) {
                for (Layer1ApiInstrumentListener layer1ApiInstrumentListener : this.instrumentListeners) {
                    layer1ApiInstrumentListener.onInstrumentNotFound(string, string2, string3);
                }
            } else {
                this.b(string, string2);
            }
        } else {
            for (Layer1ApiInstrumentListener layer1ApiInstrumentListener : this.instrumentListeners) {
                layer1ApiInstrumentListener.onInstrumentAlreadySubscribed(string, string2, string3);
            }
        }
    }

    private void b(String string, String string2) {
        k.execute(() -> this.q.subscribe(string, string2));
    }

    public void sendOrder(OrderSendParameters orderSendParameters) {
        if (!this.y.get()) {
            throw new IllegalStateException("Attempting to send order without an account being selected");
        }
        String string = this.a(orderSendParameters);
        if (orderSendParameters.getClass() == SimpleOrderSendParameters.class) {
            SimpleOrderSendParameters simpleOrderSendParameters2 = (SimpleOrderSendParameters)orderSendParameters;
            double d2 = simpleOrderSendParameters2.stopPrice;
            double d3 = simpleOrderSendParameters2.limitPrice;
            String string2 = this.a(simpleOrderSendParameters2.duration);
            Pair<int[], int[]> pair = this.a(simpleOrderSendParameters2.size, simpleOrderSendParameters2.takeProfitOffset, simpleOrderSendParameters2.additionalTakeProfitTiers);
            int[] nArray = (int[])pair.getKey();
            int[] nArray2 = (int[])pair.getValue();
            Pair<int[], int[]> pair2 = this.a(simpleOrderSendParameters2.size, simpleOrderSendParameters2.stopLossOffset, simpleOrderSendParameters2.additionalStopLossTiers);
            int[] nArray3 = (int[])pair2.getKey();
            int[] nArray4 = (int[])pair2.getValue();
            this.q.sendOrder(this.b(string), this.a(string), simpleOrderSendParameters2.clientId, simpleOrderSendParameters2.isBuy, d3, d2, simpleOrderSendParameters2.stopLossTrailingStep > 0, simpleOrderSendParameters2.size, string2, nArray, nArray2, nArray3, nArray4, simpleOrderSendParameters2.closingPositionHint, this.v, this.w);
        } else if (orderSendParameters.getClass() == OsoOrderSendParameters.class || orderSendParameters.getClass() == OcoOrderSendParameters.class) {
            List list = orderSendParameters.getClass() == OsoOrderSendParameters.class ? ((OsoOrderSendParameters)orderSendParameters).orders : ((OcoOrderSendParameters)orderSendParameters).orders;
            this.q.sendChain(orderSendParameters.getClass() == OsoOrderSendParameters.class ? "oso" : "oco", (String[])list.stream().map(simpleOrderSendParameters -> this.b(string)).toArray(String[]::new), (String[])list.stream().map(simpleOrderSendParameters -> this.a(string)).toArray(String[]::new), (String[])list.stream().map(simpleOrderSendParameters -> simpleOrderSendParameters.clientId).toArray(String[]::new), RithmicProvider.a((Boolean[])list.stream().map(simpleOrderSendParameters -> simpleOrderSendParameters.isBuy).toArray(Boolean[]::new)), list.stream().mapToDouble(simpleOrderSendParameters -> simpleOrderSendParameters.limitPrice).toArray(), list.stream().mapToDouble(simpleOrderSendParameters -> simpleOrderSendParameters.stopPrice).toArray(), list.stream().mapToInt(simpleOrderSendParameters -> 0).toArray(), list.stream().mapToInt(simpleOrderSendParameters -> simpleOrderSendParameters.size).toArray(), (String[])list.stream().map(simpleOrderSendParameters -> this.a(simpleOrderSendParameters.duration)).toArray(String[]::new), list.stream().mapToInt(simpleOrderSendParameters -> simpleOrderSendParameters.takeProfitOffset).toArray(), list.stream().mapToInt(simpleOrderSendParameters -> simpleOrderSendParameters.stopLossOffset).toArray());
        }
    }

    private Pair<int[], int[]> a(int n, int n2, List<BracketTier> list) {
        int[] nArray;
        int[] nArray2;
        if (n2 > 0) {
            nArray2 = new int[1 + list.size()];
            nArray = new int[1 + list.size()];
            nArray2[0] = n2;
            int n3 = n;
            int n4 = 0;
            for (BracketTier bracketTier : list) {
                nArray2[++n4] = bracketTier.offset;
                nArray[n4] = bracketTier.size;
                n3 -= bracketTier.size;
            }
            nArray[0] = n3;
        } else {
            nArray2 = new int[]{};
            nArray = new int[]{};
        }
        return Pair.of((Object)nArray2, (Object)nArray);
    }

    private String a(OrderDuration orderDuration) {
        String string;
        String string2 = string = orderDuration == OrderDuration.IOC ? "OC" : orderDuration.name();
        if (!("DAY".equals(string) || "FOK".equals(string) || "GTC".equals(string) || "OC".equals(string))) {
            throw new RuntimeException(string + " not supported");
        }
        return string;
    }

    public static boolean[] a(Boolean[] booleanArray) {
        int n = booleanArray.length;
        boolean[] blArray = new boolean[n];
        for (int i = 0; i < n; ++i) {
            blArray[i] = booleanArray[i];
        }
        return blArray;
    }

    public void updateOrder(OrderUpdateParameters orderUpdateParameters) {
        if (!this.y.get()) {
            throw new IllegalStateException("Attempting to update without an account being selected");
        }
        String string = orderUpdateParameters.orderId;
        String string2 = ((OrderInfoBuilder)this.a.get(orderUpdateParameters.orderId)).getInstrumentAlias();
        String string3 = this.b(string2);
        String string4 = this.a(string2);
        if (orderUpdateParameters.getClass() == OrderCancelParameters.class) {
            this.q.cancelOrder(string3, string4, string, ((OrderCancelParameters)orderUpdateParameters).batchId, ((OrderCancelParameters)orderUpdateParameters).batchEnd);
        } else if (orderUpdateParameters.getClass() == OrderMoveParameters.class) {
            OrderMoveParameters orderMoveParameters = (OrderMoveParameters)orderUpdateParameters;
            this.q.moveOrder(string3, string4, string, orderMoveParameters.limitPrice, orderMoveParameters.stopPrice);
        } else if (orderUpdateParameters.getClass() == OrderMoveToMarketParameters.class) {
            OrderMoveToMarketParameters orderMoveToMarketParameters = (OrderMoveToMarketParameters)orderUpdateParameters;
            this.q.modifyOrderToMarketPrice(string3, string4, string, orderMoveToMarketParameters.offset);
        } else if (orderUpdateParameters.getClass() == OrderResizeParameters.class) {
            OrderResizeParameters orderResizeParameters = (OrderResizeParameters)orderUpdateParameters;
            this.q.modifyOrderSize(string3, string4, string, orderResizeParameters.size);
        }
    }

    public void login(LoginData loginData) {
        this.a();
        ExtendedLoginData extendedLoginData = (ExtendedLoginData)loginData;
        Map map = extendedLoginData.extendedData;
        map.computeIfAbsent("appName", string -> new CredentialsSerializationField(false, false, "Bookmap"));
        this.v = Boolean.parseBoolean(((CredentialsSerializationField)map.get("convertToMarketOnReject")).getStringValue());
        this.w = Boolean.parseBoolean(((CredentialsSerializationField)map.get("convertBracketStopToMarketOnReject")).getStringValue());
        this.p = k.submit(() -> {
            String string = this.a("username", map);
            string = (String)ObjectUtils.firstNonNull((Object[])new String[]{this.f(), string});
            this.q = new velox.rithmic.RithmicProvider(this, string, this.a("password", map), this.a(map), ((CredentialsSerializationField)extendedLoginData.extendedData.get("appName")).getStringValue(), this.b("pluginMode", map), this.A);
            Log.info((String)"RITHMIC", (String)"Login: created native RithmicProvider");
        });
        k.execute(() -> {
            try {
                this.p.get();
            }
            catch (CancellationException cancellationException) {
            }
            catch (InterruptedException | ExecutionException exception) {
                throw new RuntimeException(exception);
            }
        });
    }

    public void close() {
        this.a();
        if (this.p != null) {
            this.p.cancel(false);
        }
        k.execute(() -> {
            if (this.q != null) {
                Log.info((String)"RITHMIC", (String)"Shut down");
                this.q.shutDown();
                this.q = null;
            }
        });
    }

    void a() {
        Layer1ApiUserMessageNotification layer1ApiUserMessageNotification = new Layer1ApiUserMessageNotification(null, i, "", false, 0, null);
        for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
            layer1ApiAdminListener.onUserMessage((Object)layer1ApiUserMessageNotification);
        }
    }

    @Override
    public void onLoginFailed(boolean bl, boolean bl2, int n) {
        k.execute(() -> {
            if (this.q == null) {
                return;
            }
            this.close();
            if (bl) {
                for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
                    layer1ApiAdminListener.onLoginFailed(LoginFailedReason.WRONG_CREDENTIALS, "Your Bookmap license only allows paper trading.");
                }
            } else if (bl2) {
                for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
                    layer1ApiAdminListener.onLoginFailed(LoginFailedReason.WRONG_CREDENTIALS, null);
                }
            } else if (n > 0) {
                String string = n > 1 ? "s" : "";
                String string2 = "You have " + n + " unsigned mandatory agreement" + string + ". Click <a href=\"http://rithmic.com/rag_paper.html\"><font color=\"white\">here</font></a> to go to the site to sign agreement" + string + ".";
                for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
                    layer1ApiAdminListener.onLoginFailed(LoginFailedReason.UNKNOWN, string2);
                }
            } else {
                Log.warn((String)"Rithmic: unable to check agreements (most likely rithmic repository is broken)");
                String string = "agreements are not signed or credentials are wrong.<br>To sign the agreements, click <a href=\"https://rithmic.com/rag_paper.html\"><font color=\"white\">here</font></a>.<br>If that doesn't work, please contact support@bookmap.com";
                for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
                    layer1ApiAdminListener.onLoginFailed(LoginFailedReason.UNKNOWN, string);
                }
            }
        });
    }

    @Override
    public void onConnectionLost() {
        Log.warn((String)"Rithmic connection lost");
        for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
            layer1ApiAdminListener.onConnectionLost(DisconnectionReason.NO_INTERNET, null);
        }
    }

    @Override
    public void onConnectionRestored() {
        Log.warn((String)"Rithmic connection restored");
        for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
            layer1ApiAdminListener.onConnectionRestored();
        }
    }

    @Override
    public void onEngineCreationFailed(int n, String string) {
        Log.error((String)("EngineCreationFailed, code=" + n + ", message=" + string));
        for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
            layer1ApiAdminListener.onLoginFailed(LoginFailedReason.NO_INTERNET_CONNECTION, null);
            if (!RithmicProvider.b()) continue;
            Log.info((String)"Sending message to restart historical data server in 30 minutes");
            layer1ApiAdminListener.onUserMessage((Object)new Layer1ApiRestartHistoricalServer(TimeUnit.MINUTES.toMillis(30L)));
        }
    }

    public static boolean b() {
        return "true".equals(System.getenv("IS_HISTORICAL_DATA_SERVER"));
    }

    @Override
    public void onLoginSuccess() {
        k.execute(() -> {
            if (this.q == null) {
                return;
            }
            this.u = this.q.isAggregated();
            for (C.a a2 : this.c.values()) {
                if (!a2.b) continue;
                if (a2.a().symbol == null || a2.a().exchange == null) {
                    throw new NullPointerException("Rithmic subscribe " + a2.a().symbol + " " + a2.a().exchange);
                }
                this.b(a2.a().symbol, a2.a().exchange);
            }
            for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
                layer1ApiAdminListener.onLoginSuccessful();
                layer1ApiAdminListener.onUserMessage((Object)new Layer1ApiIsRealTradingMessage(this.z));
            }
        });
    }

    @Override
    public void onForcedLogout() {
        for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
            layer1ApiAdminListener.onConnectionLost(DisconnectionReason.SIMULTANEOUS_LOGIN, null);
        }
    }

    @Override
    public void onAdminAlert(String string) {
        for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
            layer1ApiAdminListener.onSystemTextMessage(string, SystemTextMessageType.UNCLASSIFIED);
        }
    }

    @Override
    public void onNotify(String string) {
        for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
            layer1ApiAdminListener.onSystemTextMessage(string, SystemTextMessageType.UNCLASSIFIED);
        }
    }

    @Override
    public int selectAccount(String[] stringArray) {
        this.x.set(true);
        AccountInfo[] accountInfoArray = (AccountInfo[])Arrays.stream(stringArray).map(string -> new AccountInfo(string)).toArray(AccountInfo[]::new);
        int n = 0;
        if (this.adminListeners.size() > 0) {
            SelectAccountMessage selectAccountMessage = new SelectAccountMessage(accountInfoArray);
            for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
                layer1ApiAdminListener.onUserMessage((Object)selectAccountMessage);
            }
            try {
                n = selectAccountMessage.get();
            }
            catch (InterruptedException interruptedException) {
                Log.error((String)"Account selection failed - using the first one", (Throwable)interruptedException);
            }
        }
        if (stringArray.length > 0) {
            this.t = stringArray[n];
            this.t = this.t.split("/")[0];
        }
        this.y.set(true);
        return n;
    }

    @Override
    public void onPnlUpdate(long l, String string, String string2, int n, double d2, double d3, double d4, String string3, String string4, double d5, double d6) {
        if (string == null && string2 == null) {
            this.s = string3;
            super.a(d5 - d3, d4, d3, d6, d5, string3, -1.0, this.t);
        } else assert (string != null && string2 != null);
    }

    @Override
    public void onLineUpdate(boolean bl, String string, String string2, String string3, double d2, String string4, double d3, double d4, String string5, long l, String string6, int n, int n2, String string7, String string8, String string9, String string10, String string11, String string12) {
        OrderStatus orderStatus;
        String string13 = this.a(string2, string);
        OrderType orderType = this.e(string4);
        OrderStatus orderStatus2 = RithmicProvider.c(string7, string8);
        OrderDuration orderDuration = RithmicProvider.d(string12);
        if (orderStatus2 == null) {
            if (!StringUtils.isEmpty((CharSequence)string7)) {
                Log.warn((String)("Failed to parse order status: " + string7 + ", completion reason: " + string8));
            }
            return;
        }
        if (orderStatus2 == OrderStatus.PENDING_MODIFY && n2 == 0 && n == 0) {
            Log.warn((String)("Ignoring zero size modification, status: " + string7 + ", completion reason: " + string8));
            return;
        }
        if (orderType == null) {
            Log.warn((String)("Failed to parse order type, rawValue=" + string4 + ". Probably the type is incompatible with Bookmap, so it is ignored."));
            return;
        }
        OrderInfoBuilder orderInfoBuilder = (OrderInfoBuilder)this.a.get(string5);
        if (orderInfoBuilder == null) {
            orderInfoBuilder = new OrderInfoBuilder(string13, string5, bl, orderType, string3, false);
            this.a.put(string5, orderInfoBuilder);
        }
        if (orderStatus2 != (orderStatus = orderInfoBuilder.getStatus()) && j.contains(orderStatus)) {
            Log.warn((String)String.format("Order %s has already been %s, but now we got an order update event with status %s. Ignoring this event.", string5, orderStatus, orderStatus2));
            return;
        }
        if (orderStatus2 != OrderStatus.REJECTED || !Double.isNaN(d3)) {
            orderInfoBuilder.setLimitPrice(d3);
        }
        if (orderStatus2 != OrderStatus.REJECTED || !Double.isNaN(d4)) {
            orderInfoBuilder.setStopPrice(d4);
        }
        orderInfoBuilder.setModificationUtcTime(l);
        orderInfoBuilder.setUnfilled(n);
        orderInfoBuilder.setFilled(n2);
        orderInfoBuilder.setAverageFillPrice(d2);
        orderInfoBuilder.setStatus(orderStatus2);
        if (orderDuration != null) {
            orderInfoBuilder.setDuration(orderDuration);
        }
        if (!orderInfoBuilder.isStopTriggered()) {
            boolean bl2 = (orderType == OrderType.STP || orderType == OrderType.STP_LMT) && orderStatus2 == OrderStatus.WORKING && !string7.contains("trigger pending");
            orderInfoBuilder.setStopTriggered(bl2);
        }
        orderInfoBuilder.setExchangeId(string6);
        OrderInfoUpdate orderInfoUpdate = orderInfoBuilder.build();
        super.a(orderInfoUpdate);
        this.c(string13);
    }

    @Override
    public void onFillReport(boolean bl, int n, String string, String string2, double d2, double d3, double d4, String string3, String string4, long l, String string5, int n2, int n3, String string6, String string7, String string8, String string9, String string10) {
        if ("sod".equalsIgnoreCase(string10)) {
            return;
        }
        ExecutionInfo executionInfo = new ExecutionInfo(string4, n, d3, string10, l);
        super.a(executionInfo);
    }

    @Override
    public void addInstrument(String string, String string2, double d2, double d3, String string3) {
        String string4 = this.a(string2, string);
        String string5 = string4 + " - " + string3;
        boolean bl = !e.contains(string2.toUpperCase());
        InstrumentInfo instrumentInfo = new InstrumentInfo(string, string2, null, d2, d3, string5, bl);
        b b2 = new b(string4, instrumentInfo);
        this.c.put(string4, b2);
        b2.b = true;
        for (Layer1ApiInstrumentListener layer1ApiInstrumentListener : this.instrumentListeners) {
            layer1ApiInstrumentListener.onInstrumentAdded(string4, instrumentInfo);
        }
    }

    @Override
    public void instrumentNotFound(String string, String string2) {
        for (Layer1ApiInstrumentListener layer1ApiInstrumentListener : this.instrumentListeners) {
            layer1ApiInstrumentListener.onInstrumentNotFound(string, string2, null);
        }
    }

    @Override
    public void onDepthData(String string, String string2, boolean bl, double d2, long l, boolean bl2, long l2) {
        String string3 = this.a(string2, string);
        C.a a2 = this.c.get(string3);
        if (a2 == null) {
            return;
        }
        int n = (int)Math.round(d2 / a2.a().pips);
        if (this.o) {
            UserDataUserMessage userDataUserMessage = TimestampMessage.createTimestampUserMessage(string3, l2, 0L);
            for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
                layer1ApiAdminListener.onUserMessage((Object)userDataUserMessage);
            }
        }
        a2.a(bl, n, (int)l);
        this.a(l2);
    }

    @Override
    public void onDepthDataByOrder(String string, String string2, boolean bl, String string3, boolean bl2, double d2, double d3, int n, String string4, String string5, long l, long l2) {
        String string6 = this.a(string2, string);
        b b2 = this.c.get(string6);
        if (b2 == null) {
            return;
        }
        if ("".equals(string3)) {
            string3 = "N";
        }
        boolean bl3 = "N".equals(string3);
        boolean bl4 = "C".equals(string3);
        boolean bl5 = "D".equals(string3);
        if (!(bl3 || bl4 || bl5)) {
            throw new IllegalArgumentException("Unknown order update type: " + string3);
        }
        double d4 = b2.a().pips;
        int n2 = (int)Math.round(d3 / d4);
        long l3 = Long.parseLong(string5);
        eq eq2 = b2.f;
        HashSet<String> hashSet = b2.h;
        if (b2.i) {
            eq.b b3 = eq2.b(string4);
            if (bl5) {
                if (bl) {
                    throw new IllegalArgumentException("Order deletion in image?");
                }
                hashSet.add(string4);
                if (b3 != null) {
                    eq2.a(string4);
                }
            } else {
                boolean bl6 = hashSet.contains(string4);
                if (b3 == null && !bl6 || !bl) {
                    if (b3 != null) {
                        eq2.a(string4);
                    }
                    eq2.a(string4, bl2, n2, n, l3);
                }
            }
        } else {
            if (g) {
                for (Object object : this.adminListeners) {
                    object.onUserMessage((Object)new OrderPriorityMessage(string6, string4, l3));
                }
            }
            if (this.o) {
                UserDataUserMessage userDataUserMessage = TimestampMessage.createTimestampUserMessage(string6, l, l2);
                for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
                    layer1ApiAdminListener.onUserMessage((Object)userDataUserMessage);
                }
            }
            if (bl3) {
                for (Object object : this.mboDataListeners) {
                    object.onMboSend(string6, string4, bl2, n2, n);
                }
                try {
                    eq2.a(string4, bl2, n2, n, l3);
                }
                catch (IllegalArgumentException illegalArgumentException) {
                    Log.warn((String)"Rithmic data corruption?", (Exception)illegalArgumentException);
                }
            } else if (bl4) {
                for (Object object : this.mboDataListeners) {
                    object.onMboReplace(string6, string4, n2, n);
                }
                try {
                    eq2.a(string4, n2, n, l3);
                }
                catch (IllegalArgumentException illegalArgumentException) {
                    Log.warn((String)"Rithmic data corruption?", (Exception)illegalArgumentException);
                }
            } else if (bl5) {
                for (Object object : this.mboDataListeners) {
                    object.onMboCancel(string6, string4);
                }
                try {
                    eq2.a(string4);
                }
                catch (IllegalArgumentException illegalArgumentException) {
                    Log.warn((String)"Rithmic data corruption?", (Exception)illegalArgumentException);
                }
            } else {
                throw new RuntimeException("Unknown event type");
            }
        }
        this.a(l);
    }

    private void a(long l) {
        if (l != 0L) {
            this.r.a(l);
        }
    }

    private void b(long l) {
        if (this.u) {
            return;
        }
        boolean bl = l != 0L;
        double d2 = (double)l / (double)TimeUnit.SECONDS.toNanos(1L);
        String string = String.format("Data latency spike detected! (~%.1f seconds delay; Connection: Rithmic)", d2);
        Layer1ApiUserMessageNotification layer1ApiUserMessageNotification = new Layer1ApiUserMessageNotification(null, i, string, bl, 0, null);
        for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
            layer1ApiAdminListener.onUserMessage((Object)layer1ApiUserMessageNotification);
        }
        if (l > 0L) {
            PerformanceLoggingHelper.logPerformance();
        }
    }

    @Override
    public void onDepthDataByOrderImageStart(String string, String string2) {
        String string3 = this.a(string2, string);
        b b2 = this.c.get(string3);
        b2.i = true;
        if (b2.g == null) {
            b2.g = b2.f;
        }
        b2.f = new eq();
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    @Override
    public void onDepthDataByOrderImageEnd(String string, String string2) {
        String string3 = this.a(string2, string);
        Layer1ApiTimeFreeze layer1ApiTimeFreeze = new Layer1ApiTimeFreeze(f, this.getClass());
        try {
            Object object;
            Object object222;
            for (Object object222 : this.adminListeners) {
                object222.onUserMessage((Object)layer1ApiTimeFreeze);
            }
            b b3 = this.c.get(string3);
            b3.i = false;
            b3.h.clear();
            object222 = b3.g;
            eq eq2 = b3.f;
            HashSet<eq.b> hashSet = new HashSet<eq.b>(IterableUtils.toList((Iterable)object222));
            hashSet.removeIf(b2 -> eq2.c(b2.a()));
            for (eq.b object3 : hashSet) {
                ((eq)object222).a(object3.a());
                for (Layer1ApiMboDataListener layer1ApiMboDataListener : this.mboDataListeners) {
                    layer1ApiMboDataListener.onMboCancel(string3, object3.a());
                }
            }
            for (Map.Entry entry : eq2.a().entrySet()) {
                object = (eq.a)((eq)object222).a().get(entry.getKey());
                this.a(string3, (eq.a)object, (eq.a)entry.getValue(), (eq)object222, eq2);
            }
            for (Map.Entry entry : eq2.b().entrySet()) {
                object = (eq.a)((eq)object222).b().get(entry.getKey());
                this.a(string3, (eq.a)object, (eq.a)entry.getValue(), (eq)object222, eq2);
            }
            b3.g = null;
        }
        finally {
            layer1ApiTimeFreeze.resume();
        }
    }

    private void a(String string, eq.a a2, eq.a a3, eq eq2, eq eq3) {
        if (a3.equals(a2)) {
            return;
        }
        SortedMap<Long, eq.b> sortedMap = a3.a();
        for (Map.Entry<Long, eq.b> entry : sortedMap.entrySet()) {
            eq.b b2 = entry.getValue();
            String string2 = b2.a();
            if (g) {
                for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
                    layer1ApiAdminListener.onUserMessage((Object)new OrderPriorityMessage(string, b2.a(), b2.e()));
                }
            }
            if (!eq2.c(string2)) {
                for (Layer1ApiAdminListener layer1ApiAdminListener : this.mboDataListeners) {
                    layer1ApiAdminListener.onMboSend(string, b2.a(), b2.b(), b2.c(), b2.d());
                }
                continue;
            }
            for (Layer1ApiAdminListener layer1ApiAdminListener : this.mboDataListeners) {
                eq.b b3 = eq2.b(string2);
                if (b3 != null && b3.c() == b2.c()) {
                    layer1ApiAdminListener.onMboReplace(string, b2.a(), b2.c(), b2.d() + 1);
                }
                layer1ApiAdminListener.onMboReplace(string, b2.a(), b2.c(), b2.d());
            }
        }
    }

    @Override
    public void onMarketMode(String string, String string2, String string3) {
        String string4 = this.a(string2, string);
        C.a a2 = this.c.get(string4);
        if (a2 == null) {
            return;
        }
        MarketMode marketMode = MarketMode.valueOfLoose((String)string3);
        if (marketMode == null) {
            Log.debug((String)("Received marked mode " + string3 + " for " + string4 + " - not parsed, considering Open"));
            marketMode = MarketMode.OPEN;
        }
        for (Layer1ApiDataListener layer1ApiDataListener : this.dataListeners) {
            layer1ApiDataListener.onMarketMode(string4, marketMode);
        }
    }

    @Override
    public void onTrade(String string, String string2, double d2, int n, String string3, long l, String string4, String string5) {
        String string6 = this.a(string2, string);
        C.a a2 = this.c.get(string6);
        if (a2 == null) {
            return;
        }
        if (n == 0) {
            Log.warn((String)("Ignored zero-size trade from Rithmic for " + string6));
            return;
        }
        double d3 = d2 / a2.a().pips;
        boolean bl = "B".equals(string3) ? true : ("S".equals(string3) ? false : a2.a(d3));
        boolean bl2 = false;
        a2.a.onTrade(d3, string4, bl, false, n, string4, string5);
    }

    @Override
    public void onNewOrder(String string, String string2, String string3, boolean bl, double d2, int n) {
    }

    @Override
    public void onOrderRejected(String string, String string2, boolean bl, double d2, int n, boolean bl2, String string3) {
        if (bl2) {
            return;
        }
        for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
            layer1ApiAdminListener.onSystemTextMessage(string3, SystemTextMessageType.ORDER_FAILURE);
        }
    }

    @Override
    public void onOrderFailure(String string, String string2, boolean bl, double d2, String string3) {
        for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
            layer1ApiAdminListener.onSystemTextMessage(string3, SystemTextMessageType.ORDER_FAILURE);
        }
    }

    @Override
    public void onOrderUpdated(String string, String string2, String string3, double d2, int n, int n2) {
    }

    @Override
    public void onOrderCancelled(String string, String string2, String string3) {
    }

    @Override
    public void onExecution(String string, String string2, String string3, String string4, boolean bl, double d2, int n) {
    }

    @Override
    public void onStatus(String string, String string2, String string3, double d2, double d3, int n, double d4, int n2) {
        String string4 = this.a(string2, string);
        StatusInfoBuilder statusInfoBuilder = new StatusInfoBuilder().setInstrumentAlias(string4).setUnrealizedPnl(d2).setRealizedPnl(d3).setCurrency(this.s).setPosition(n).setAveragePrice(d4).setVolume(n2);
        this.l.put(string4, statusInfoBuilder);
        this.c(string4);
    }

    @Override
    public void onPositionExit(String string, String string2) {
        String string3 = this.a(string2, string);
        Layer1ApiPositionCloseCompleteMessage layer1ApiPositionCloseCompleteMessage = new Layer1ApiPositionCloseCompleteMessage(string3);
        for (Layer1ApiAdminListener layer1ApiAdminListener : this.adminListeners) {
            layer1ApiAdminListener.onUserMessage((Object)layer1ApiPositionCloseCompleteMessage);
        }
    }

    private void c(String string) {
        StatusInfoBuilder statusInfoBuilder = this.l.get(string);
        if (statusInfoBuilder != null) {
            WorkingOrdersCounter workingOrdersCounter = (WorkingOrdersCounter)this.b.get(string);
            if (workingOrdersCounter != null) {
                statusInfoBuilder.setWorkingBuys(workingOrdersCounter.getWorkingBuys());
                statusInfoBuilder.setWorkingSells(workingOrdersCounter.getWorkingSells());
            }
            StatusInfo statusInfo = statusInfoBuilder.build();
            for (Layer1ApiTradingListener layer1ApiTradingListener : this.tradingListeners) {
                layer1ApiTradingListener.onStatus(statusInfo);
            }
        }
    }

    public void unsubscribe(String string) {
        C.a a2 = this.c.get(string);
        if (a2 == null) {
            return;
        }
        String string2 = a2.a().symbol;
        String string3 = a2.a().exchange;
        k.execute(() -> this.q.unsubscribe(string2, string3));
        if (a2.b) {
            for (Layer1ApiInstrumentListener layer1ApiInstrumentListener : this.instrumentListeners) {
                layer1ApiInstrumentListener.onInstrumentRemoved(string);
            }
            a2.b = false;
        }
    }

    private static OrderDuration d(String string) {
        if ("OC".equals(string)) {
            return OrderDuration.IOC;
        }
        OrderDuration orderDuration = OrderDuration.valueOfLoose((String)string);
        if (orderDuration == null) {
            Log.error((String)"BMDEV-5195", (String)("orderDuration is null. tried to parse unknown duration: \"" + string + "\""));
        }
        return orderDuration;
    }

    private OrderType e(String string) {
        switch (string) {
            case "L": {
                return OrderType.LMT;
            }
            case "M": {
                return OrderType.MKT;
            }
            case "STP": {
                return OrderType.STP;
            }
            case "SLMT": {
                return OrderType.STP_LMT;
            }
        }
        return null;
    }

    private static OrderStatus c(String string, String string2) {
        switch (string = string.toLowerCase()) {
            case "open pending": 
            case "order sent to exch": 
            case "order received by exch gateway": 
            case "order received from client": {
                return OrderStatus.PENDING_SUBMIT;
            }
            case "cancel pending": 
            case "cancel sent to exch": 
            case "cancel received by exch gateway": 
            case "cancel received from client": {
                return OrderStatus.PENDING_CANCEL;
            }
            case "modify pending": 
            case "modify sent to exch": 
            case "modify received by exch gateway": 
            case "modify received from client": {
                return OrderStatus.PENDING_MODIFY;
            }
            case "open": 
            case "modified": 
            case "modified, trigger pending": 
            case "trigger pending": 
            case "partial": {
                return OrderStatus.WORKING;
            }
            case "complete": {
                switch (string2) {
                    case "C": 
                    case "PFBC": {
                        return OrderStatus.CANCELLED;
                    }
                    case "R": 
                    case "FA": {
                        return OrderStatus.REJECTED;
                    }
                    case "F": {
                        return OrderStatus.FILLED;
                    }
                }
                return null;
            }
        }
        return null;
    }

    public String getSource() {
        return "Rithmic";
    }

    public Layer1ApiProviderSupportedFeatures getSupportedFeatures() {
        Layer1ApiProviderSupportedFeaturesBuilder layer1ApiProviderSupportedFeaturesBuilder = RithmicProvider.c().toBuilder();
        layer1ApiProviderSupportedFeaturesBuilder.setTrading(this.x.get());
        layer1ApiProviderSupportedFeaturesBuilder.setMbo(!this.u);
        layer1ApiProviderSupportedFeaturesBuilder.setBracketTiers(true);
        layer1ApiProviderSupportedFeaturesBuilder.setSubscriptionInfoFunction(RithmicProvider::a);
        return layer1ApiProviderSupportedFeaturesBuilder.build();
    }

    @MaximumSupportedFeatures
    public static Layer1ApiProviderSupportedFeatures c() {
        Layer1ApiProviderSupportedFeaturesBuilder layer1ApiProviderSupportedFeaturesBuilder = new Layer1ApiProviderSupportedFeaturesBuilder();
        layer1ApiProviderSupportedFeaturesBuilder.setTrading(true);
        layer1ApiProviderSupportedFeaturesBuilder.setOco(true);
        layer1ApiProviderSupportedFeaturesBuilder.setMbo(true);
        layer1ApiProviderSupportedFeaturesBuilder.setTrailingStopsAsBracketChildren(true);
        layer1ApiProviderSupportedFeaturesBuilder.setBrackets(true);
        layer1ApiProviderSupportedFeaturesBuilder.setMarketMode(true);
        layer1ApiProviderSupportedFeaturesBuilder.setSupportedOrderDurations(Arrays.asList(OrderDuration.DAY, OrderDuration.GTC, OrderDuration.FOK, OrderDuration.IOC));
        layer1ApiProviderSupportedFeaturesBuilder.setSupportedStopOrders(Arrays.asList(OrderType.MKT, OrderType.LMT));
        layer1ApiProviderSupportedFeaturesBuilder.setConvertOrderToMkt(true);
        layer1ApiProviderSupportedFeaturesBuilder.setBalanceSupported(true);
        layer1ApiProviderSupportedFeaturesBuilder.setExchangeUsedForSubscription(true);
        layer1ApiProviderSupportedFeaturesBuilder.setTypeUsedForSubscription(false);
        layer1ApiProviderSupportedFeaturesBuilder.setKnownInstruments(RithmicProvider.e());
        layer1ApiProviderSupportedFeaturesBuilder.setReceiveCrossTradingStatusMessage(true);
        return layer1ApiProviderSupportedFeaturesBuilder.build();
    }

    public static String a(SubscribeInfo subscribeInfo) {
        return "<html>To see the symbol table, click <a href=\"https://www.bookmap.com/api/v1/redirect/symbol-table\"><font color=\"white\">here</font></a></html>";
    }

    private static List<SubscribeInfo> e() {
        String string = System.getenv("HISTORICAL_SERVER_INSTRUMENTS");
        if (string != null) {
            ArrayList<SubscribeInfo> arrayList = new ArrayList<SubscribeInfo>();
            for (String string2 : string.split(",")) {
                String[] stringArray = string2.split("@");
                arrayList.add(new SubscribeInfo(stringArray[0], stringArray[1], null));
            }
            return arrayList;
        }
        return Arrays.asList(new SubscribeInfo(null, "CME", null), new SubscribeInfo(null, "CBOT", null), new SubscribeInfo(null, "NYMEX", null), new SubscribeInfo(null, "COMEX", null), new SubscribeInfo(null, "EUREX", null));
    }

    public String a(Map<String, CredentialsSerializationField> map) {
        if (!map.containsKey("system") || !map.containsKey("gateway")) {
            return "";
        }
        String string = map.get("system").getStringValue();
        String string2 = map.get("gateway").getStringValue();
        boolean bl = this.b("aggregateQuotes", map);
        this.z = !string.equals("Rithmic Paper Trading") && !string.equals("Rithmic 01 Test");
        return RithmicFieldManager.a(string, string2, bl);
    }

    private String a(String string, Map<String, CredentialsSerializationField> map) {
        return map.getOrDefault(string, new CredentialsSerializationField(false, false, "")).getStringValue();
    }

    private boolean b(String string, Map<String, CredentialsSerializationField> map) {
        String string2 = this.a(string, map);
        if (string2.equals("")) {
            return false;
        }
        return Boolean.valueOf(string2);
    }

    private String f() {
        try {
            Class<?> clazz = Layer1ApiProvider.class.getClassLoader().loadClass("velox.api.layer1.common.helper.External");
            return (String)clazz.getMethod("getInitializer", new Class[0]).invoke(null, new Object[0]);
        }
        catch (ClassNotFoundException | IllegalAccessException | IllegalArgumentException | NoSuchMethodException | SecurityException | InvocationTargetException exception) {
            if (exception.getCause() != null && exception.getCause() instanceof IllegalStateException) {
                return null;
            }
            return "";
        }
    }

    public void acceptUserLicenseFields(Map<String, String> map) {
        this.A = ep.a(map);
    }

    private void f(String string) {
        string = string.toUpperCase();
        String string2 = this.b(string);
        String string3 = this.a(string);
        this.q.initInstrument(string2, string3);
    }

    @Override
    public Object sendUserMessage(Object object) {
        if (object instanceof CrossTradingStatusMessage) {
            CrossTradingStatusMessage crossTradingStatusMessage = (CrossTradingStatusMessage)object;
            if (crossTradingStatusMessage.status == CrossTradingStatus.STARTED) {
                this.f(crossTradingStatusMessage.targetAlias);
            }
            return null;
        }
        return super.sendUserMessage(object);
    }

    private static class a {
        private static final long a = TimeUnit.MILLISECONDS.toNanos(500L);
        private static final long b = TimeUnit.SECONDS.toNanos(10L);
        private static final long c = TimeUnit.MILLISECONDS.toNanos(500L);
        private static final long d = TimeUnit.MILLISECONDS.toNanos(5L);
        private static final long e = TimeUnit.MINUTES.toMillis(5L);
        private final Consumer<Long> f;
        private final Supplier<Long> g;
        private long h = Long.MAX_VALUE;
        private long i = 0L;
        private long j = Long.MAX_VALUE;
        private long k = 0L;
        private boolean l = false;

        public a(Consumer<Long> consumer, Supplier<Long> supplier) {
            this.f = consumer;
            this.g = supplier;
        }

        synchronized void a(long l) {
            long l2 = System.nanoTime();
            long l3 = System.currentTimeMillis();
            if (this.h < l2) {
                if (this.i < l2) {
                    long l4 = l - l2;
                    if (this.k < l3 - e) {
                        this.j = l4;
                    } else {
                        long l5 = this.j - l4;
                        if (l5 > a) {
                            Log.warn((String)("Rithmic data latency spike detected " + (double)l5 / 1000000.0 + "ms"));
                            Log.warn((String)("Rithmic pending bytes: " + this.g.get()));
                            this.f.accept(l5);
                            this.l = true;
                        } else if (this.l) {
                            this.f.accept(0L);
                            this.l = false;
                        }
                        Log.trace((String)("Rithmic data latency spike " + (double)l5 / 1000000.0 + "ms"));
                        this.j = l4 > this.j ? l4 : (this.j -= d);
                    }
                    this.i = l2 + c;
                }
                this.k = l3;
            } else if (this.h == Long.MAX_VALUE) {
                this.h = l2 + b;
            }
        }
    }

    private class b
    extends C.a {
        private eq f;
        private eq g;
        private final HashSet<String> h;
        private boolean i;

        public b(String string, InstrumentInfo instrumentInfo) {
            super(string, instrumentInfo);
            this.f = new eq();
            this.g = null;
            this.h = new HashSet();
            this.i = true;
        }
    }

    public static class TimestampMessage {
        public final String alias;
        public final long timestampGateway;
        public final long timestampExchange;

        private TimestampMessage(String string, long l, long l2) {
            this.alias = string;
            this.timestampGateway = l;
            this.timestampExchange = l2;
        }

        public static UserDataUserMessage createTimestampUserMessage(String string, long l, long l2) {
            byte[] byArray = Longs.toByteArray((long)l);
            byte[] byArray2 = Longs.toByteArray((long)l2);
            byte[] byArray3 = ArrayUtils.addAll((byte[])byArray, (byte[])byArray2);
            return new UserDataUserMessage("RithmicTimestampMessage.V2", string, byArray3);
        }

        public static TimestampMessage parse(UserDataUserMessage userDataUserMessage) {
            long l = Longs.fromByteArray((byte[])userDataUserMessage.data);
            byte[] byArray = ArrayUtils.subarray((byte[])userDataUserMessage.data, (int)8, (int)16);
            long l2 = Longs.fromByteArray((byte[])byArray);
            return new TimestampMessage(userDataUserMessage.alias, l, l2);
        }

        public static boolean isTimestampMessage(UserDataUserMessage userDataUserMessage) {
            String string = userDataUserMessage.tag;
            return "RithmicTimestampMessage.V2".equals(string);
        }
    }

    public static class OrderPriorityMessage
    implements Layer1ApiIgnorableUpwardMessage {
        public final String alias;
        public final String orderId;
        public final long priority;

        public OrderPriorityMessage(String string, String string2, long l) {
            this.alias = string;
            this.orderId = string2;
            this.priority = l;
        }
    }
}

