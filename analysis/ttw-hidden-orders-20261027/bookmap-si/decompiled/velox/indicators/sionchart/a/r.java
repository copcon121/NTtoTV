/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.a;

import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;

public class r {
    private static RuntimeException b(Exception exception) {
        return exception instanceof RuntimeException ? (RuntimeException)exception : new d(exception);
    }

    @FunctionalInterface
    public static interface h<T, E extends Exception> {
        public boolean a(T var1);

        public static <T, E extends Exception> Predicate<T> a(h<T, E> h2) {
            return object -> {
                try {
                    return h2.a(object);
                }
                catch (Exception exception) {
                    throw new RuntimeException(exception);
                }
            };
        }
    }

    @FunctionalInterface
    public static interface c<T1, T2, E extends Exception> {
        public void a(T1 var1, T2 var2);

        public static <T1, T2, E extends Exception> BiConsumer<T1, T2> a(c<T1, T2, E> c2) {
            return (object, object2) -> {
                try {
                    c2.a(object, object2);
                }
                catch (Exception exception) {
                    throw new RuntimeException(exception);
                }
            };
        }
    }

    @FunctionalInterface
    public static interface b<T, E extends Exception> {
        public void a(T var1);

        public static <T, E extends Exception> Consumer<T> a(b<T, E> b2) {
            return object -> {
                try {
                    b2.a(object);
                }
                catch (Exception exception) {
                    throw new RuntimeException(exception);
                }
            };
        }
    }

    @FunctionalInterface
    public static interface a<E extends Exception> {
        public void a();

        public static <E extends Exception> Runnable a(a<E> a2) {
            return () -> {
                try {
                    a2.a();
                }
                catch (Exception exception) {
                    throw new RuntimeException(exception);
                }
            };
        }
    }

    @FunctionalInterface
    public static interface g<T1, T2, R, E extends Exception> {
        public R a(T1 var1, T2 var2);

        public static <T1, T2, R, E extends Exception> BiFunction<T1, T2, R> a(g<T1, T2, R, E> g2) {
            return (object, object2) -> {
                try {
                    return g2.a(object, object2);
                }
                catch (Exception exception) {
                    throw new RuntimeException(exception);
                }
            };
        }
    }

    @FunctionalInterface
    public static interface f<T, R, E extends Exception> {
        public R a(T var1);

        public static <T, R, E extends Exception> Function<T, R> a(f<T, R, E> f2) {
            return object -> {
                try {
                    return f2.a(object);
                }
                catch (Exception exception) {
                    throw new RuntimeException(exception);
                }
            };
        }
    }

    @FunctionalInterface
    public static interface e<R, E extends Exception> {
        public R a();

        public static <R, E extends Exception> Supplier<R> a(e<R, E> e2) {
            return () -> {
                try {
                    return e2.a();
                }
                catch (Exception exception) {
                    throw r.b(exception);
                }
            };
        }
    }

    public static class d
    extends RuntimeException {
        private static final long b = -2960907767997781837L;
        public Exception a;

        public d(Exception exception) {
            super(exception);
            this.a = exception;
        }
    }
}

