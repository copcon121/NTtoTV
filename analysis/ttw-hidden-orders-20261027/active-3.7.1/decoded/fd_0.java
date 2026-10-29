/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import ttw.tradefinder.cd;
import ttw.tradefinder.f_0;
import ttw.tradefinder.fb_2;
import ttw.tradefinder.fg_0;
import ttw.tradefinder.ub_1;
import ttw.tradefinder.vE;

/*
 * Renamed from ttw.tradefinder.Fd
 */
public class fd_0
implements Runnable {
    private static int D = 6000;
    private static final String A;
    private final f_0 C;
    private Boolean M;
    private static final fb_2 b;
    private final BlockingQueue<ub_1> c;

    public /* synthetic */ fd_0(f_0 a2) {
        fd_0 a3;
        fd_0 fd_02 = a3;
        fd_02.c = new LinkedBlockingQueue<ub_1>();
        fd_02.M = Boolean.TRUE;
        fd_02.C = a2;
    }

    public /* synthetic */ void j() {
        fd_0 a2;
        a2.c.clear();
    }

    public /* synthetic */ String E() {
        return A;
    }

    static {
        b = new fb_2();
        A = UUID.randomUUID().toString().replace("-", "");
    }

    public /* synthetic */ void E(ub_1 a2) {
        fd_0 a3;
        a3.c.offer(a2);
    }

    public /* synthetic */ void E() {
        a.M = Boolean.FALSE;
    }

    @Override
    public /* synthetic */ void run() {
        a2.M = Boolean.TRUE;
        b.E();
        try {
            block7: while (true) {
                fd_0 a2;
                fd_0 fd_02 = a2;
                while (fd_02.M.booleanValue()) {
                    String string;
                    String string2;
                    ub_1 ub_12;
                    block13: {
                        block12: {
                            block11: {
                                ub_12 = a2.c.take();
                                if (ub_12.a()) {
                                    return;
                                }
                                try {
                                    if (a2.C.j() || ub_12.E() == cd.H) break block11;
                                    ub_12.E(true);
                                    fd_02 = a2;
                                    continue;
                                }
                                catch (Exception exception) {
                                    ub_12.a();
                                    continue block7;
                                }
                            }
                            string2 = ub_12.j();
                            if (string2 != null && !string2.isEmpty()) break block12;
                            ub_12.E(false);
                            fd_02 = a2;
                            continue;
                        }
                        string = ub_12.E();
                        if (string != null && !string.isEmpty()) break block13;
                        ub_12.E(false);
                        fd_02 = a2;
                        continue;
                    }
                    if (string.equals("XXXXXX-XXXXX-XXXXXX-XXXXX-XXXXXX")) {
                        ub_12.E(false);
                        continue block7;
                    }
                    boolean bl = b.E(string, string2, A, D);
                    ub_12.E(bl);
                    fd_02 = a2;
                }
                break;
            }
            return;
        }
        catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
            return;
        }
    }
}

