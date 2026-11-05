/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.Layer1ApiBasicListenable
 *  velox.api.layer1.Layer1ApiDataListener
 *  velox.api.layer1.Layer1ApiProvider
 *  velox.api.layer1.Layer1ApiTradingListener
 *  velox.api.layer1.common.NanoClock
 *  velox.api.layer1.data.BalanceInfo
 *  velox.api.layer1.data.BalanceInfo$BalanceInCurrency
 *  velox.api.layer1.data.BalanceInfoBuilder
 *  velox.api.layer1.data.ExecutionInfo
 *  velox.api.layer1.data.InstrumentInfo
 *  velox.api.layer1.data.OcoOrderSendParameters
 *  velox.api.layer1.data.OrderInfo
 *  velox.api.layer1.data.OrderInfoBuilder
 *  velox.api.layer1.data.OrderInfoUpdate
 *  velox.api.layer1.data.OrderSendParameters
 *  velox.api.layer1.data.OsoOrderSendParameters
 *  velox.api.layer1.data.SimpleOrderSendParameters
 *  velox.api.layer1.data.SingleOrderSendParameters
 *  velox.api.layer1.messages.Layer1ApiGetAliasMessage
 *  velox.api.layer1.messages.Layer1ApiIgnorableDownwardMessage
 *  velox.api.layer1.providers.WorkingOrdersCounter
 *  velox.api.layer1.providers.data.TradeAggregator
 */
package velox.api.layer1.providers;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.TreeMap;
import velox.api.layer1.Layer1ApiBasicListenable;
import velox.api.layer1.Layer1ApiDataListener;
import velox.api.layer1.Layer1ApiProvider;
import velox.api.layer1.Layer1ApiTradingListener;
import velox.api.layer1.common.NanoClock;
import velox.api.layer1.data.BalanceInfo;
import velox.api.layer1.data.BalanceInfoBuilder;
import velox.api.layer1.data.ExecutionInfo;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.data.OcoOrderSendParameters;
import velox.api.layer1.data.OrderInfo;
import velox.api.layer1.data.OrderInfoBuilder;
import velox.api.layer1.data.OrderInfoUpdate;
import velox.api.layer1.data.OrderSendParameters;
import velox.api.layer1.data.OsoOrderSendParameters;
import velox.api.layer1.data.SimpleOrderSendParameters;
import velox.api.layer1.data.SingleOrderSendParameters;
import velox.api.layer1.messages.Layer1ApiGetAliasMessage;
import velox.api.layer1.messages.Layer1ApiIgnorableDownwardMessage;
import velox.api.layer1.providers.WorkingOrdersCounter;
import velox.api.layer1.providers.data.TradeAggregator;

public abstract class C
extends Layer1ApiBasicListenable
implements Layer1ApiProvider {
    protected final HashMap<String, OrderInfoBuilder> a = new HashMap();
    protected final HashMap<String, WorkingOrdersCounter> b = new HashMap();
    private final HashMap<String, ArrayList<ExecutionInfo>> c = new HashMap();
    private BalanceInfoBuilder d = new BalanceInfoBuilder();

    protected void a(OrderInfoUpdate orderInfoUpdate) {
        Object object2;
        String string = orderInfoUpdate.orderId;
        String string2 = orderInfoUpdate.instrumentAlias;
        for (Object object2 : this.tradingListeners) {
            object2.onOrderUpdated(orderInfoUpdate);
        }
        ArrayList<ExecutionInfo> arrayList = this.c.get(string);
        if (arrayList != null) {
            for (ExecutionInfo executionInfo : arrayList) {
                for (Layer1ApiTradingListener layer1ApiTradingListener : this.tradingListeners) {
                    layer1ApiTradingListener.onOrderExecuted(executionInfo);
                }
            }
            this.c.remove(string);
        }
        this.b.putIfAbsent(string2, new WorkingOrdersCounter());
        object2 = this.b.get(string2);
        object2.onOrderUpdated((OrderInfo)orderInfoUpdate);
    }

    protected void a(ExecutionInfo executionInfo) {
        String string = executionInfo.orderId;
        if (this.a.containsKey(string)) {
            for (Layer1ApiTradingListener layer1ApiTradingListener : this.tradingListeners) {
                layer1ApiTradingListener.onOrderExecuted(executionInfo);
            }
        } else {
            this.c.putIfAbsent(string, new ArrayList());
            this.c.get(string).add(executionInfo);
        }
    }

    public void a(double d2, double d3, double d4, double d5, double d6, String string, double d7, String string2) {
        BalanceInfo.BalanceInCurrency balanceInCurrency = new BalanceInfo.BalanceInCurrency(d2, d3, d4, d5, d6, string, d7 >= 0.0 ? Double.valueOf(d7) : null);
        this.d.updateBalanceInCurrency(balanceInCurrency);
        this.d.setAccountName(string2);
        BalanceInfo balanceInfo = this.d.build();
        for (Layer1ApiTradingListener layer1ApiTradingListener : this.tradingListeners) {
            layer1ApiTradingListener.onBalance(balanceInfo);
        }
    }

    public long getCurrentTime() {
        return NanoClock.currentTimeNanos();
    }

    public String formatPrice(String string, double d2) {
        return null;
    }

    protected String a(OrderSendParameters orderSendParameters) {
        if (orderSendParameters instanceof SingleOrderSendParameters) {
            return ((SingleOrderSendParameters)orderSendParameters).alias;
        }
        if (orderSendParameters instanceof OcoOrderSendParameters) {
            return ((SimpleOrderSendParameters)((OcoOrderSendParameters)orderSendParameters).orders.get((int)0)).alias;
        }
        if (orderSendParameters instanceof OsoOrderSendParameters) {
            return ((SimpleOrderSendParameters)((OsoOrderSendParameters)orderSendParameters).orders.get((int)0)).alias;
        }
        throw new UnsupportedOperationException("Unknown order type, can't extract alias");
    }

    public Object sendUserMessage(Object object) {
        if (object instanceof Layer1ApiGetAliasMessage) {
            Layer1ApiGetAliasMessage layer1ApiGetAliasMessage = (Layer1ApiGetAliasMessage)object;
            return this.a(layer1ApiGetAliasMessage.exchange, layer1ApiGetAliasMessage.symbol);
        }
        if (object instanceof Layer1ApiIgnorableDownwardMessage) {
            return null;
        }
        throw new RuntimeException("User message {" + object + "} was not handled before reaching the provider");
    }

    protected abstract String a(String var1, String var2);

    protected class a {
        private final String e;
        private final InstrumentInfo f;
        public final TradeAggregator a;
        boolean b = false;
        private boolean g;
        private final TreeMap<Integer, Integer> h = new TreeMap(Collections.reverseOrder());
        private final TreeMap<Integer, Integer> i = new TreeMap();

        public a(String string, InstrumentInfo instrumentInfo) {
            this.e = string;
            this.a = new TradeAggregator((d2, n, tradeInfo) -> {
                for (Layer1ApiDataListener layer1ApiDataListener : C.this.dataListeners) {
                    layer1ApiDataListener.onTrade(string, d2, n, tradeInfo);
                }
            });
            this.f = instrumentInfo;
        }

        public InstrumentInfo a() {
            return this.f;
        }

        public boolean a(double d2) {
            boolean bl;
            double d3 = this.h.size() > 0 ? (double)this.h.firstKey().intValue() : 0.0;
            double d4 = this.i.size() > 0 ? (double)this.i.firstKey().intValue() : 0.0;
            double d5 = Math.abs(d2 - d3);
            double d6 = Math.abs(d2 - d4);
            boolean bl2 = bl = d5 > d6;
            if (d5 == d6) {
                bl = this.g;
            }
            this.g = bl;
            return bl;
        }

        public void a(boolean bl, int n, int n2) {
            TreeMap<Integer, Integer> treeMap = bl ? this.h : this.i;
            this.a(treeMap, n, n2);
            for (Layer1ApiDataListener layer1ApiDataListener : C.this.dataListeners) {
                layer1ApiDataListener.onDepth(this.e, bl, n, n2);
            }
        }

        private boolean a(TreeMap<Integer, Integer> treeMap, int n, int n2) {
            if (n2 <= 0) {
                assert (n2 == 0);
                return treeMap.remove(n) != null;
            }
            return Integer.valueOf(n2) != treeMap.put(n, n2);
        }
    }
}

