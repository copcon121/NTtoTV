/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.CalculatedResultListener
 *  velox.api.layer1.layers.strategies.interfaces.InvalidateInterface
 */
package ttw.tradefinder;

import java.util.function.Consumer;
import ttw.tradefinder.c_0;
import velox.api.layer1.layers.strategies.interfaces.CalculatedResultListener;
import velox.api.layer1.layers.strategies.interfaces.InvalidateInterface;

/*
 * Renamed from ttw.tradefinder.u
 */
public interface u_0
extends c_0 {
    public void E(Consumer<Object> var1, InvalidateInterface var2);

    public void E(long var1, long var3, int var5, CalculatedResultListener var6);
}

