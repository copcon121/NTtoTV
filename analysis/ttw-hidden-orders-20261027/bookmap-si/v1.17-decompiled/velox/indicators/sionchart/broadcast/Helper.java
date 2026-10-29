/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.broadcast;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;

public class Helper {
    public static byte[] serialize(Object object) {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        try {
            ObjectOutputStream objectOutputStream = new ObjectOutputStream(byteArrayOutputStream);
            objectOutputStream.writeObject(object);
            objectOutputStream.close();
        }
        catch (IOException iOException) {
            throw new RuntimeException(iOException);
        }
        return byteArrayOutputStream.toByteArray();
    }

    public static Object deserialize(byte[] byArray) {
        try {
            ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(byArray);
            ObjectInputStream objectInputStream = new ObjectInputStream(byteArrayInputStream);
            Object object = objectInputStream.readObject();
            objectInputStream.close();
            return object;
        }
        catch (Exception exception) {
            throw new RuntimeException(exception);
        }
    }
}

