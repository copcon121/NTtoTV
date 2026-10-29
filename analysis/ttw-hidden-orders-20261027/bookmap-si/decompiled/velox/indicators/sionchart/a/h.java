/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.a;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

public class h {
    public static void a(Object object, Object object2) {
        try {
            h.a(object, object2, Object.class);
        }
        catch (Exception exception) {
            throw new RuntimeException(exception);
        }
    }

    public static void a(Object object, Object object2, Class clazz) {
        Class<?> clazz2 = object.getClass();
        Class<?> clazz3 = object2.getClass();
        List<Field> list = h.a(clazz2, clazz);
        List<Field> list2 = h.a(clazz3, clazz);
        for (Field field : list) {
            Field field2 = h.a(field, list2);
            if (field2 == null) continue;
            field2.set(object2, field.get(object));
        }
    }

    private static List<Field> a(Class clazz, Class clazz2) {
        ArrayList<Field> arrayList = new ArrayList<Field>();
        do {
            for (Field field : clazz.getDeclaredFields()) {
                int n2 = field.getModifiers();
                if (Modifier.isStatic(n2) || !Modifier.isPublic(n2)) continue;
                arrayList.add(field);
            }
        } while ((clazz = clazz.getSuperclass()) != null && clazz != clazz2);
        return arrayList;
    }

    private static Field a(Field field, List<Field> list) {
        Iterator<Field> iterator = list.iterator();
        while (iterator.hasNext()) {
            Field field2 = iterator.next();
            if (!field.getName().equals(field2.getName()) || !field.getType().equals(field2.getType())) continue;
            iterator.remove();
            return field2;
        }
        return null;
    }
}

