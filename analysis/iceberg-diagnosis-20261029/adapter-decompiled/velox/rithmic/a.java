/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.io.FileUtils
 *  org.apache.commons.lang3.SystemUtils
 *  velox.api.layer1.common.Log
 *  velox.api.layer1.common.temporaryfiles.TemporaryFile
 */
package velox.rithmic;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.SystemUtils;
import velox.api.layer1.common.Log;
import velox.api.layer1.common.temporaryfiles.TemporaryFile;

public class a {
    private static boolean a = false;

    public static void a() {
        Object object;
        boolean bl;
        if (a) {
            return;
        }
        a = true;
        boolean bl2 = bl = System.getProperty("debug") != null;
        if (SystemUtils.IS_OS_WINDOWS) {
            object = "rithmic/windows/RithmicAdapter" + (bl ? "_d" : "") + ".dll";
        } else if (SystemUtils.IS_OS_MAC) {
            object = "rithmic/mac/librithmic.dylib";
        } else if (SystemUtils.IS_OS_LINUX) {
            object = "rithmic/linux/librithmic.so";
        } else {
            throw new UnsupportedOperationException("Unsupported OS");
        }
        Log.debug((String)("Loading RithmicAdapter file: " + (String)object));
        String string = "RithmicDll-" + System.currentTimeMillis() + ".dll";
        TemporaryFile temporaryFile = new TemporaryFile(Paths.get(string, new String[0]), false);
        temporaryFile.create();
        Path path = temporaryFile.getPath();
        try (InputStream inputStream = a.class.getClassLoader().getResourceAsStream((String)object);){
            FileUtils.copyInputStreamToFile((InputStream)inputStream, (File)path.toFile());
        }
        catch (IOException iOException) {
            throw new RuntimeException("Failed to extract " + (String)object + " to " + path);
        }
        System.load(path.toString());
    }
}

