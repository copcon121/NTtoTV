/*
 * Decompiled with CFR 0.152.
 */
package velox.bookmap;

import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Objects;
import java.util.SortedMap;
import java.util.TreeMap;
import velox.bookmap.er;

public class eq
implements Iterable<b> {
    private SortedMap<Integer, a> a = new TreeMap(Collections.reverseOrder());
    private SortedMap<Integer, a> b = new TreeMap<Integer, a>();
    private Map<String, b> c = new HashMap<String, b>();

    public void a(String string, boolean bl, int n2, int n3, long l) {
        b b2 = new b(string, bl, n2, n3, l);
        if (this.c.put(string, b2) != null) {
            throw new IllegalArgumentException("Order already exists " + string);
        }
        this.a(bl).computeIfAbsent(n2, n -> new a()).a(b2);
    }

    public void a(String string, int n2, int n3, long l) {
        b b2 = this.c.get(string);
        if (b2 == null) {
            throw new IllegalArgumentException("Modified order does not exist " + string);
        }
        b b3 = new b(string, b2.b, n2, n3, l);
        this.c.put(string, b3);
        if (b2.c == n2 && b2.e == l) {
            b2.a(n3);
        } else {
            SortedMap<Integer, a> sortedMap = this.a(b2.b);
            a a2 = (a)sortedMap.get(b2.c);
            a2.b(b2);
            if (a2.a.isEmpty()) {
                sortedMap.remove(b2.c);
            }
            sortedMap.computeIfAbsent(n2, n -> new a()).a(b3);
        }
    }

    public void a(String string) {
        b b2 = this.c.remove(string);
        if (b2 == null) {
            throw new IllegalArgumentException("Cancelled order does not exist " + string);
        }
        SortedMap<Integer, a> sortedMap = this.a(b2.b);
        a a2 = (a)sortedMap.get(b2.c);
        a2.b(b2);
        if (a2.a.isEmpty()) {
            sortedMap.remove(b2.c);
        }
    }

    private SortedMap<Integer, a> a(boolean bl) {
        return bl ? this.a : this.b;
    }

    @Override
    public Iterator<b> iterator() {
        return new er(this);
    }

    public b b(String string) {
        return this.c.get(string);
    }

    public boolean c(String string) {
        return this.b(string) != null;
    }

    public SortedMap<Integer, a> a() {
        return this.a;
    }

    public SortedMap<Integer, a> b() {
        return this.b;
    }

    public static class b {
        private String a;
        private boolean b;
        private int c;
        private int d;
        private long e;

        public b(String string, boolean bl, int n, int n2, long l) {
            this.a = string;
            this.b = bl;
            this.c = n;
            this.d = n2;
            this.e = l;
        }

        public void a(int n) {
            this.d = n;
        }

        public String a() {
            return this.a;
        }

        public boolean b() {
            return this.b;
        }

        public int c() {
            return this.c;
        }

        public int d() {
            return this.d;
        }

        public long e() {
            return this.e;
        }

        public int hashCode() {
            return Objects.hash(this.b, this.a, this.c, this.e, this.d);
        }

        public boolean equals(Object object) {
            if (this == object) {
                return true;
            }
            if (object == null) {
                return false;
            }
            if (this.getClass() != object.getClass()) {
                return false;
            }
            b b2 = (b)object;
            return this.b == b2.b && Objects.equals(this.a, b2.a) && this.c == b2.c && this.e == b2.e && this.d == b2.d;
        }
    }

    public static class a {
        private SortedMap<Long, b> a = new TreeMap<Long, b>();

        public void a(b b2) {
            b b3 = this.a.put(b2.e, b2);
            if (b3 != null) {
                throw new RuntimeException("Order " + b2.a + " with priority " + b2.e + " already exists");
            }
        }

        public void b(b b2) {
            b b3 = (b)this.a.remove(b2.e);
            if (b3 == null) {
                throw new RuntimeException("Order " + b2.a + " with priority " + b2.e + " does not exists");
            }
        }

        public SortedMap<Long, b> a() {
            return this.a;
        }

        public int hashCode() {
            return Objects.hash(this.a);
        }

        public boolean equals(Object object) {
            if (this == object) {
                return true;
            }
            if (object == null) {
                return false;
            }
            if (this.getClass() != object.getClass()) {
                return false;
            }
            a a2 = (a)object;
            return Objects.equals(this.a, a2.a);
        }
    }
}

