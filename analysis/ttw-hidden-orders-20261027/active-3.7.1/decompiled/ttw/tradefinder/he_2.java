/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.common.Log
 */
package ttw.tradefinder;

import java.io.ByteArrayInputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.Clip;
import ttw.tradefinder.qd_2;
import ttw.tradefinder.ra_1;
import ttw.tradefinder.te_1;
import ttw.tradefinder.tf_0;
import ttw.tradefinder.wd_2;
import ttw.tradefinder.we_2;
import velox.api.layer1.common.Log;

/*
 * Renamed from ttw.tradefinder.He
 */
public class he_2 {
    private final ExecutorService A;
    private static Lock C = new ReentrantLock();
    private Clip M;
    private tf_0 b;
    private boolean c;

    public he_2() {
        he_2 a2;
        he_2 he_22 = a2;
        a2.b = new tf_0();
        he_22.c = false;
        he_22.M = null;
        he_22.A = Executors.newSingleThreadExecutor();
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    private /* synthetic */ void E(byte[] a222) {
        block9: {
            he_2 a3;
            if (!C.tryLock()) {
                return;
            }
            if (a3.M != null && a3.M.isActive()) {
                he_2 he_22 = a3;
                he_22.M.stop();
                he_22.M.flush();
                he_22.M = null;
            }
            try {
                Object a222;
                a3.M = AudioSystem.getClip();
                a3.M.addLineListener(new we_2(a3));
                a222 = AudioSystem.getAudioInputStream(new ByteArrayInputStream((byte[])a222));
                try {
                    he_2 he_23 = a3;
                    he_23.M.open((AudioInputStream)a222);
                    he_23.M.setFramePosition(0);
                    he_23.M.start();
                    if (a222 == null) break block9;
                }
                catch (Throwable throwable) {
                    Throwable throwable2;
                    if (a222 != null) {
                        try {
                            ((AudioInputStream)a222).close();
                            throwable2 = throwable;
                            throw throwable2;
                        }
                        catch (Throwable a222) {
                            throwable.addSuppressed(a222);
                        }
                    }
                    throwable2 = throwable;
                    throw throwable2;
                }
                ((AudioInputStream)a222).close();
            }
            catch (Exception a222) {
                Log.error((String)ra_1.E("\u00028\u0013-r'\u001d!\u001c0"), (Throwable)a222);
            }
        }
        C.unlock();
    }

    public void E(qd_2 a2) {
        he_2 a3;
        if (((qd_2)a2).c == te_1.A) {
            return;
        }
        if (a3.c) {
            return;
        }
        byte[] byArray = a3.b.E((qd_2)a2);
        a2 = byArray;
        if (byArray == null) {
            return;
        }
        if (!C.tryLock()) {
            return;
        }
        a3.A.execute(() -> a3.E((byte[])a2));
        C.unlock();
    }

    public void E() {
        he_2 a2;
        a2.c = true;
        try {
            he_2 he_22 = a2;
            he_22.A.shutdownNow();
            a2.A.shutdown();
            he_22.A.awaitTermination(3L, TimeUnit.SECONDS);
        }
        catch (Exception exception) {
            Log.error((String)wd_2.E("5]\u0002D\u001eG\u0014\u00144L\u0014W\u0004@\u001eF"), (Throwable)exception);
        }
        C.lock();
        if (a2.M != null && a2.M.isActive()) {
            he_2 he_23 = a2;
            he_23.M.stop();
            he_23.M.flush();
        }
        a2.M = null;
        C.unlock();
    }
}

