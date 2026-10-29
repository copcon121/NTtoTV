/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ia;

/*
 * Renamed from ttw.tradefinder.wa
 */
public abstract class wa_2<T extends ia> {
    public boolean b;
    private final Class<T> c;

    public abstract void void_E(T var1);

    public static String java_lang_String_E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (2 ^ 5) << 3;
        int n5 = n3;
        int n6 = 3 << 3 ^ 1;
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

    public abstract T E();

    public wa_2(Class<T> a2) {
        wa_2 a3;
        wa_2 wa_22 = a3;
        wa_22.b = true;
        wa_22.c = a2;
    }

    public Class<T> E() {
        wa_2 a2;
        return a2.c;
    }
}

