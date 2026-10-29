/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.utils.SoundSynthHelper
 */
package ttw.tradefinder;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import javax.sound.sampled.AudioFileFormat;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import ttw.tradefinder.ba_2;
import ttw.tradefinder.gd_2;
import ttw.tradefinder.ge_1;
import ttw.tradefinder.qd_2;
import ttw.tradefinder.rd_2;
import velox.api.layer1.layers.utils.SoundSynthHelper;

/*
 * Renamed from ttw.tradefinder.TF
 */
public class tf_0 {
    private Map<String, byte[]> c = new HashMap<String, byte[]>();

    public tf_0() {
        tf_0 a2;
    }

    private /* synthetic */ byte[] j(String a2) {
        tf_0 a3;
        if (a3.c.containsKey(a2)) {
            return a3.c.get(a2);
        }
        try {
            return a3.E((String)a2, new BufferedInputStream(new FileInputStream((String)a2)));
        }
        catch (Exception exception) {
            a2 = exception;
            exception.printStackTrace();
            return null;
        }
    }

    private /* synthetic */ byte[] E(String a2, InputStream a3) {
        tf_0 a4;
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream(40960);
        if (a3 != null) {
            a3 = AudioSystem.getAudioInputStream(a3);
            AudioSystem.write((AudioInputStream)a3, AudioFileFormat.Type.WAVE, byteArrayOutputStream);
            a4.c.put(a2, byteArrayOutputStream.toByteArray());
            return a4.c.get(a2);
        }
        a4.c.put(a2, null);
        return null;
    }

    /*
     * Enabled aggressive block sorting
     */
    public byte[] E(qd_2 a2) {
        tf_0 a3;
        switch (a2.c) {
            case b: {
                return a3.E(a2.b);
            }
            case D: {
                if (a2.C.isEmpty()) {
                    return a3.E(rd_2.H);
                }
                return a3.j(a2.C);
            }
            case c: 
            case M: {
                if (a2.C.isEmpty()) {
                    return a3.E(rd_2.H);
                }
                return SoundSynthHelper.synthesize((String)a2.C);
            }
        }
        return a3.E(rd_2.H);
    }

    /*
     * Enabled aggressive block sorting
     */
    private /* synthetic */ byte[] E(rd_2 a2) {
        switch (a2) {
            case A: {
                tf_0 a3;
                return a3.E("sounds/attention.wav");
            }
            case C: {
                tf_0 a3;
                return a3.E("sounds/notification.wav");
            }
            case M: {
                tf_0 a3;
                return a3.E("sounds/signal.wav");
            }
            case D: {
                tf_0 a3;
                return a3.E("sounds/confirmation.wav");
            }
            case c: {
                tf_0 a3;
                return a3.E("sounds/pricelevel.wav");
            }
            case H: {
                tf_0 a3;
                return a3.E("sounds/silence.wav");
            }
        }
        return null;
    }

    private /* synthetic */ byte[] E(String a2) {
        tf_0 a3;
        if (a3.c.containsKey(a2)) {
            return a3.c.get(a2);
        }
        try {
            return a3.E((String)a2, new BufferedInputStream(ba_2.class.getClassLoader().getResourceAsStream((String)a2)));
        }
        catch (Exception exception) {
            a2 = exception;
            exception.printStackTrace();
            return null;
        }
    }
}

