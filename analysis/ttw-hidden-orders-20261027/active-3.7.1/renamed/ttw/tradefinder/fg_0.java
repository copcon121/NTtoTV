/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.concurrent.BlockingQueue;
import ttw.tradefinder.ka_2;
import ttw.tradefinder.tf_2;

/*
 * Renamed from ttw.tradefinder.Fg
 */
public class fg_0
implements Runnable {
    private Boolean C;
    private final String M;
    private final ka_2 b;
    private final BlockingQueue<tf_2> c;

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (2 ^ 5) << 4;
        int cfr_ignored_0 = (2 ^ 5) << 3 ^ 1;
        int n5 = n3;
        int n6 = 2 << 3 ^ (3 ^ 5);
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

    public fg_0(BlockingQueue<tf_2> a2, String a3, ka_2 a4) {
        fg_0 a5;
        fg_0 fg_02 = a5;
        a5.C = Boolean.TRUE;
        a5.b = a4;
        fg_02.c = a2;
        fg_02.M = a3;
    }

    @Override
    public void run() {
        a2.C = Boolean.TRUE;
        try {
            fg_0 a2;
            while (a2.C.booleanValue()) {
                tf_2 tf_22 = a2.c.take();
                ArrayList<String> arrayList = new ArrayList<String>();
                tf_2 tf_23 = tf_22;
                String string = tf_23.b;
                String string2 = tf_23.c;
                fg_0 fg_02 = a2;
                arrayList.add(tf_22.M);
                while (!fg_02.c.isEmpty()) {
                    tf_22 = a2.c.take();
                    if (tf_22.b.equals(string) && tf_22.c.equals(string2)) {
                        fg_02 = a2;
                        arrayList.add(tf_22.M);
                        continue;
                    }
                    if (arrayList.contains(a2.M)) {
                        return;
                    }
                    fg_02 = a2;
                    tf_2 tf_24 = tf_22;
                    a2.b.E(new tf_2(string, string2, String.join((CharSequence)System.lineSeparator(), arrayList)));
                    string = tf_24.b;
                    string2 = tf_24.c;
                    ArrayList<String> arrayList2 = arrayList;
                    arrayList2.clear();
                    arrayList2.add(tf_22.M);
                }
                if (arrayList.contains(a2.M)) {
                    return;
                }
                a2.b.E(new tf_2(string, string2, String.join((CharSequence)System.lineSeparator(), arrayList)));
            }
            return;
        }
        catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
            return;
        }
    }
}

