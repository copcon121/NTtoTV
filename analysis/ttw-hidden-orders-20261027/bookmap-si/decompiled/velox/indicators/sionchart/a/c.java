/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.indicators.AliasFilter
 *  velox.api.layer1.simplified.IntervalListener
 *  velox.api.layer1.simplified.MarketByOrderDepthDataListener
 */
package velox.indicators.sionchart.a;

import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import velox.api.layer1.messages.indicators.AliasFilter;
import velox.api.layer1.simplified.IntervalListener;
import velox.api.layer1.simplified.MarketByOrderDepthDataListener;

public class c {
    public static IntervalListener a(l<Long> l2, a a2) {
        return new velox.indicators.sionchart.a.d(a2, l2);
    }

    public static AliasFilter a(m<String, Boolean> m2) {
        return new velox.indicators.sionchart.a.e(m2);
    }

    public static MarketByOrderDepthDataListener a(e<String, Boolean, Integer, Integer> e2, d<String, Integer, Integer> d2, b<String> b2) {
        return new velox.indicators.sionchart.a.f(e2, d2, b2);
    }

    @SafeVarargs
    public static MouseListener a(b<MouseEvent> ... bArray) {
        b<MouseEvent> b2 = mouseEvent -> {};
        List list = Stream.of(Arrays.copyOf(bArray, 5)).map(b3 -> b3 == null ? b2 : b3).collect(Collectors.toList());
        return new velox.indicators.sionchart.a.g(list);
    }

    public static class w
    implements Runnable {
        private final Runnable a = () -> {};
        private Runnable b;

        public w(Runnable runnable) {
            this.b = runnable;
        }

        @Override
        public void run() {
            this.b.run();
            this.b = this.a;
        }
    }

    @FunctionalInterface
    public static interface v<T> {
        public T a(T var1, T var2, T var3, T var4, T var5);
    }

    @FunctionalInterface
    public static interface u<T> {
        public T a(T var1, T var2, T var3, T var4);
    }

    @FunctionalInterface
    public static interface t<T> {
        public T a(T var1, T var2, T var3);
    }

    @FunctionalInterface
    public static interface s<T> {
        public T a(T var1, T var2);
    }

    @FunctionalInterface
    public static interface r<T> {
        public T a(T var1);
    }

    @FunctionalInterface
    public static interface k<T> {
        public void a(T var1, T var2, T var3, T var4, T var5);
    }

    @FunctionalInterface
    public static interface j<T> {
        public void a(T var1, T var2, T var3, T var4);
    }

    @FunctionalInterface
    public static interface i<T> {
        public void a(T var1, T var2, T var3);
    }

    @FunctionalInterface
    public static interface h<T> {
        public void a(T var1, T var2);
    }

    @FunctionalInterface
    public static interface g<T> {
        public void a(T var1);
    }

    @FunctionalInterface
    public static interface q<T1, T2, T3, T4, T5, R> {
        public R a(T1 var1, T2 var2, T3 var3, T4 var4, T5 var5);
    }

    @FunctionalInterface
    public static interface p<T1, T2, T3, T4, R> {
        public R a(T1 var1, T2 var2, T3 var3, T4 var4);
    }

    @FunctionalInterface
    public static interface o<T1, T2, T3, R> {
        public R a(T1 var1, T2 var2, T3 var3);
    }

    @FunctionalInterface
    public static interface n<T1, T2, R> {
        public R a(T1 var1, T2 var2);
    }

    @FunctionalInterface
    public static interface m<T1, R> {
        public R a(T1 var1);
    }

    @FunctionalInterface
    public static interface l<R> {
        public R a();
    }

    @FunctionalInterface
    public static interface f<T1, T2, T3, T4, T5> {
        public void a(T1 var1, T2 var2, T3 var3, T4 var4, T5 var5);
    }

    @FunctionalInterface
    public static interface e<T1, T2, T3, T4> {
        public void accept(T1 var1, T2 var2, T3 var3, T4 var4);
    }

    @FunctionalInterface
    public static interface d<T1, T2, T3> {
        public void accept(T1 var1, T2 var2, T3 var3);
    }

    @FunctionalInterface
    public static interface c<T1, T2> {
        public void accept(T1 var1, T2 var2);
    }

    @FunctionalInterface
    public static interface b<T1> {
        public void accept(T1 var1);
    }

    @FunctionalInterface
    public static interface a {
        public void a();
    }
}

