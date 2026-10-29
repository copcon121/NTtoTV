/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  com.google.gson.GsonBuilder
 *  com.google.gson.JsonElement
 *  com.google.gson.JsonObject
 */
package a.a.a.a.c;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

public final class a {
    public static JsonElement a(String string, String string2) {
        String[] stringArray;
        JsonObject jsonObject = (JsonObject)new GsonBuilder().create().fromJson(string, JsonObject.class);
        for (String string3 : stringArray = string2.split("\\.")) {
            JsonElement jsonElement;
            if (jsonObject != null) {
                jsonElement = jsonObject.get(string3);
                if (!jsonElement.isJsonObject()) {
                    return jsonElement;
                }
            } else {
                return null;
            }
            jsonObject = jsonElement.getAsJsonObject();
        }
        return jsonObject;
    }

    private a() {
        throw new InstantiationError();
    }
}

