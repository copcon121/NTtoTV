/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.common.DirectoryResolver
 */
package ttw.tradefinder;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.FileAttribute;
import java.util.Date;
import ttw.tradefinder.bC;
import ttw.tradefinder.ie_1;
import ttw.tradefinder.vE;
import velox.api.layer1.common.DirectoryResolver;

/*
 * Renamed from ttw.tradefinder.EF
 */
public class ef_2 {
    private final Path C;
    private static final String M = vE.E("W");
    private final String b;
    private BufferedWriter c;

    public /* synthetic */ void j() {
        ef_2 a2;
        if (a2.c == null) {
            return;
        }
        try {
            ef_2 ef_22 = a2;
            ef_22.c.flush();
            ef_22.c.close();
            return;
        }
        catch (Exception exception) {
            exception.printStackTrace();
            return;
        }
    }

    public /* synthetic */ ef_2(String a2) {
        ef_2 a3;
        ef_2 ef_22 = a3;
        a3.C = DirectoryResolver.getBookmapDirectoryByName((String)vE.E("\u0003/\u0000V\u0007?z7\u0018<\u00102\u0019<"));
        ef_22.c = null;
        ef_22.b = a2 + ".txt";
    }

    private /* synthetic */ File E() {
        ef_2 a2;
        try {
            Files.createDirectories(a2.C, new FileAttribute[0]);
        }
        catch (Exception exception) {}
        String string = ie_1.E(new Date()) + "_" + a2.b;
        return Paths.get(a2.C.toString(), string).toFile();
    }

    public /* synthetic */ void E(long a22, double a3, double a4, double a5, double a6, double a7) {
        try {
            ef_2 a8;
            if (a8.c == null) {
                a8.c = new BufferedWriter(new FileWriter(a8.E(), false));
            }
            a8.c.write(String.join((CharSequence)bC.E("2"), ie_1.E(a22), Double.toString(a3), Double.toString(a4), Double.toString(a5), Double.toString(a6), Double.toString(a7)));
            ef_2 ef_22 = a8;
            ef_22.c.newLine();
            ef_22.c.flush();
            return;
        }
        catch (IOException iOException) {
            IOException a22 = iOException;
            iOException.printStackTrace();
            return;
        }
    }

    public /* synthetic */ void E() {
        try {
            ef_2 a2;
            if (a2.c == null) {
                return;
            }
            a2.c.newLine();
            return;
        }
        catch (IOException iOException) {
            iOException.printStackTrace();
            return;
        }
    }
}

