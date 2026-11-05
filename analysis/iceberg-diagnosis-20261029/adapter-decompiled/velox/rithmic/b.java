/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.common.Log
 */
package velox.rithmic;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import velox.api.layer1.common.Log;
import velox.rithmic.IRithmicListener;

public class b
implements IRithmicListener {
    private static final ExecutorService a = Executors.newSingleThreadExecutor();
    private final IRithmicListener b;

    public b(IRithmicListener iRithmicListener) {
        this.b = iRithmicListener;
    }

    private void a(Throwable throwable) {
        a.execute(() -> {
            Log.error((String)"Exception leaking into C++ code", (Throwable)throwable);
            throw new RuntimeException("Exception leaking into C++ code", throwable);
        });
    }

    @Override
    public void onLoginFailed(boolean bl, boolean bl2, int n) {
        try {
            this.b.onLoginFailed(bl, bl2, n);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onEngineCreationFailed(int n, String string) {
        try {
            this.b.onEngineCreationFailed(n, string);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onLoginSuccess() {
        try {
            this.b.onLoginSuccess();
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onConnectionLost() {
        try {
            this.b.onConnectionLost();
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onConnectionRestored() {
        try {
            this.b.onConnectionRestored();
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onForcedLogout() {
        try {
            this.b.onForcedLogout();
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onAdminAlert(String string) {
        try {
            this.b.onAdminAlert(string);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onNotify(String string) {
        try {
            this.b.onNotify(string);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public int selectAccount(String[] stringArray) {
        try {
            return this.b.selectAccount(stringArray);
        }
        catch (Throwable throwable) {
            this.a(throwable);
            return 0;
        }
    }

    @Override
    public void onPnlUpdate(long l, String string, String string2, int n, double d2, double d3, double d4, String string3, String string4, double d5, double d6) {
        try {
            this.b.onPnlUpdate(l, string, string2, n, d2, d3, d4, string3, string4, d5, d6);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onLineUpdate(boolean bl, String string, String string2, String string3, double d2, String string4, double d3, double d4, String string5, long l, String string6, int n, int n2, String string7, String string8, String string9, String string10, String string11, String string12) {
        try {
            this.b.onLineUpdate(bl, string, string2, string3, d2, string4, d3, d4, string5, l, string6, n, n2, string7, string8, string9, string10, string11, string12);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onFillReport(boolean bl, int n, String string, String string2, double d2, double d3, double d4, String string3, String string4, long l, String string5, int n2, int n3, String string6, String string7, String string8, String string9, String string10) {
        try {
            this.b.onFillReport(bl, n, string, string2, d2, d3, d4, string3, string4, l, string5, n2, n3, string6, string7, string8, string9, string10);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void addInstrument(String string, String string2, double d2, double d3, String string3) {
        try {
            this.b.addInstrument(string, string2, d2, d3, string3);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void instrumentNotFound(String string, String string2) {
        try {
            this.b.instrumentNotFound(string, string2);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onDepthData(String string, String string2, boolean bl, double d2, long l, boolean bl2, long l2) {
        try {
            this.b.onDepthData(string, string2, bl, d2, l, bl2, l2);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onDepthDataByOrder(String string, String string2, boolean bl, String string3, boolean bl2, double d2, double d3, int n, String string4, String string5, long l, long l2) {
        try {
            this.b.onDepthDataByOrder(string, string2, bl, string3, bl2, d2, d3, n, string4, string5, l, l2);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onDepthDataByOrderImageStart(String string, String string2) {
        try {
            this.b.onDepthDataByOrderImageStart(string, string2);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onDepthDataByOrderImageEnd(String string, String string2) {
        try {
            this.b.onDepthDataByOrderImageEnd(string, string2);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onMarketMode(String string, String string2, String string3) {
        try {
            this.b.onMarketMode(string, string2, string3);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onTrade(String string, String string2, double d2, int n, String string3, long l, String string4, String string5) {
        try {
            this.b.onTrade(string, string2, d2, n, string3, l, string4, string5);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onNewOrder(String string, String string2, String string3, boolean bl, double d2, int n) {
        try {
            this.b.onNewOrder(string, string2, string3, bl, d2, n);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onOrderRejected(String string, String string2, boolean bl, double d2, int n, boolean bl2, String string3) {
        try {
            this.b.onOrderRejected(string, string2, bl, d2, n, bl2, string3);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onOrderFailure(String string, String string2, boolean bl, double d2, String string3) {
        try {
            this.b.onOrderFailure(string, string2, bl, d2, string3);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onOrderUpdated(String string, String string2, String string3, double d2, int n, int n2) {
        try {
            this.b.onOrderUpdated(string, string2, string3, d2, n, n2);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onOrderCancelled(String string, String string2, String string3) {
        try {
            this.b.onOrderCancelled(string, string2, string3);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onExecution(String string, String string2, String string3, String string4, boolean bl, double d2, int n) {
        try {
            this.b.onExecution(string, string2, string3, string4, bl, d2, n);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onStatus(String string, String string2, String string3, double d2, double d3, int n, double d4, int n2) {
        try {
            this.b.onStatus(string, string2, string3, d2, d3, n, d4, n2);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }

    @Override
    public void onPositionExit(String string, String string2) {
        try {
            this.b.onPositionExit(string, string2);
        }
        catch (Throwable throwable) {
            this.a(throwable);
        }
    }
}

