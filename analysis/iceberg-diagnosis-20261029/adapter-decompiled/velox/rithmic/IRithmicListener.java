/*
 * Decompiled with CFR 0.152.
 */
package velox.rithmic;

public interface IRithmicListener {
    public void onLoginFailed(boolean var1, boolean var2, int var3);

    default public void onLoginFailed(boolean bl, int n) {
        this.onLoginFailed(false, bl, n);
    }

    public void onEngineCreationFailed(int var1, String var2);

    public void onLoginSuccess();

    public void onConnectionLost();

    public void onConnectionRestored();

    public void onForcedLogout();

    public void onAdminAlert(String var1);

    public void onNotify(String var1);

    public int selectAccount(String[] var1);

    public void onPnlUpdate(long var1, String var3, String var4, int var5, double var6, double var8, double var10, String var12, String var13, double var14, double var16);

    public void onLineUpdate(boolean var1, String var2, String var3, String var4, double var5, String var7, double var8, double var10, String var12, long var13, String var15, int var16, int var17, String var18, String var19, String var20, String var21, String var22, String var23);

    public void onFillReport(boolean var1, int var2, String var3, String var4, double var5, double var7, double var9, String var11, String var12, long var13, String var15, int var16, int var17, String var18, String var19, String var20, String var21, String var22);

    public void addInstrument(String var1, String var2, double var3, double var5, String var7);

    public void instrumentNotFound(String var1, String var2);

    public void onDepthData(String var1, String var2, boolean var3, double var4, long var6, boolean var8, long var9);

    public void onDepthDataByOrder(String var1, String var2, boolean var3, String var4, boolean var5, double var6, double var8, int var10, String var11, String var12, long var13, long var15);

    public void onDepthDataByOrderImageStart(String var1, String var2);

    public void onDepthDataByOrderImageEnd(String var1, String var2);

    public void onMarketMode(String var1, String var2, String var3);

    public void onTrade(String var1, String var2, double var3, int var5, String var6, long var7, String var9, String var10);

    public void onNewOrder(String var1, String var2, String var3, boolean var4, double var5, int var7);

    public void onOrderRejected(String var1, String var2, boolean var3, double var4, int var6, boolean var7, String var8);

    public void onOrderFailure(String var1, String var2, boolean var3, double var4, String var6);

    public void onOrderUpdated(String var1, String var2, String var3, double var4, int var6, int var7);

    public void onOrderCancelled(String var1, String var2, String var3);

    public void onExecution(String var1, String var2, String var3, String var4, boolean var5, double var6, int var8);

    public void onStatus(String var1, String var2, String var3, double var4, double var6, int var8, double var9, int var11);

    public void onPositionExit(String var1, String var2);
}

