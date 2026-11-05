/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.common.VersionHelper
 */
package velox.rithmic;

import java.util.Objects;
import velox.api.layer1.common.VersionHelper;
import velox.rithmic.IRithmicListener;
import velox.rithmic.RithmicConfigurationManager;
import velox.rithmic.a;
import velox.rithmic.b;

public class RithmicProvider {
    protected long nativeDataPtr;

    private static native void initId();

    public RithmicProvider(IRithmicListener iRithmicListener, String string, String string2, String string3, String string4, boolean bl, boolean bl2) {
        String string5 = RithmicConfigurationManager.a(string3);
        String string6 = RithmicConfigurationManager.b(string3);
        boolean bl3 = RithmicConfigurationManager.c(string3);
        if (!bl3 && !bl2) {
            iRithmicListener.onLoginFailed(true, false, 0);
        } else if (string.isEmpty() || string2.isEmpty() || string5 == null || string6 == null) {
            iRithmicListener.onLoginFailed(false, true, 0);
        } else {
            String string7 = Objects.requireNonNull(VersionHelper.getBookmapVersion());
            iRithmicListener = new b(iRithmicListener);
            this.construct(iRithmicListener, string, string2, string5, string6, string4, string7, bl);
        }
    }

    public native boolean isAggregated();

    private native void construct(IRithmicListener var1, String var2, String var3, String var4, String var5, String var6, String var7, boolean var8);

    public native void shutDown();

    public native void unsubscribe(String var1, String var2);

    public native void subscribe(String var1, String var2);

    public native void sendOrder(String var1, String var2, String var3, boolean var4, double var5, double var7, boolean var9, int var10, String var11, int[] var12, int[] var13, int[] var14, int[] var15, boolean var16, boolean var17, boolean var18);

    public native void sendChain(String var1, String[] var2, String[] var3, String[] var4, boolean[] var5, double[] var6, double[] var7, int[] var8, int[] var9, String[] var10, int[] var11, int[] var12);

    public native void cancelOrder(String var1, String var2, String var3, long var4, boolean var6);

    public native void modifyOrderToMarketPrice(String var1, String var2, String var3, int var4);

    public native void modifyOrderSize(String var1, String var2, String var3, int var4);

    public native void moveOrder(String var1, String var2, String var3, double var4, double var6);

    public native long getPendingMarketDataConnectionInputSize();

    public native void initInstrument(String var1, String var2);

    static {
        a.a();
        RithmicProvider.initId();
    }
}

