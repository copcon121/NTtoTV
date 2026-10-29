/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Iterator;
import java.util.PriorityQueue;

/*
 * Renamed from ttw.tradefinder.sF
 */
public class sf_0
extends PriorityQueue<Long> {
    private long M;
    private final int b;
    private static final long c = -4212378830293009744L;

    public /* synthetic */ long E() {
        sf_0 a2;
        Iterator iterator;
        long l2 = 0L;
        Iterator iterator2 = iterator = a2.iterator();
        while (iterator2.hasNext()) {
            Long l3 = (Long)iterator.next();
            l2 += l3.longValue();
            iterator2 = iterator;
        }
        return l2;
    }

    public /* synthetic */ sf_0(int a2) {
        sf_0 a3;
        sf_0 sf_02 = a3;
        sf_02.M = Long.MAX_VALUE;
        sf_02.b = a2;
    }

    public /* synthetic */ void E(long a2) {
        sf_0 a3;
        if (a3.size() < a3.b) {
            a3.add(a2);
            a3.M = Math.min(a3.M, a2);
            return;
        }
        if (a2 < a3.M) {
            return;
        }
        sf_0 sf_02 = a3;
        sf_02.add(a2);
        a3.poll();
        sf_02.M = (Long)sf_02.peek();
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (2 ^ 5) << 4 ^ 3 << 1;
        int cfr_ignored_0 = 4 << 3;
        int n5 = n3;
        int n6 = (3 ^ 5) << 4 ^ 2 << 1;
        while (n5 >= 0) {
            int n7 = n3--;
            a2[n7] = (char)(((String)object2).charAt(n7) ^ n6);
            if (n3 < 0) break;
            int n8 = n3--;
            a2[n8] = (char)(((String)object2).charAt(n8) ^ n4);
            n5 = n3;
        }
        return new String((char[])a2);
    }
}

