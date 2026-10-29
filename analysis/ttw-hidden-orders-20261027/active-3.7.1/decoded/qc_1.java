/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.colors.Colors
 */
package ttw.tradefinder;

import java.awt.Component;
import java.awt.image.BufferedImage;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;
import javax.imageio.ImageIO;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JEditorPane;
import javax.swing.JLabel;
import javax.swing.JPasswordField;
import javax.swing.SwingUtilities;
import javax.swing.text.JTextComponent;
import ttw.tradefinder.Ya;
import ttw.tradefinder.ba_1;
import ttw.tradefinder.ba_2;
import ttw.tradefinder.cd;
import ttw.tradefinder.dc_0;
import ttw.tradefinder.de_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.eo;
import ttw.tradefinder.f_0;
import ttw.tradefinder.fd_0;
import ttw.tradefinder.gc_1;
import ttw.tradefinder.hd_1;
import ttw.tradefinder.i_0;
import ttw.tradefinder.k_0;
import ttw.tradefinder.ne_1;
import ttw.tradefinder.pb_1;
import ttw.tradefinder.qb_1;
import ttw.tradefinder.sb_1;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.tb_1;
import ttw.tradefinder.ub_1;
import ttw.tradefinder.wa_1;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.xf_1;
import ttw.tradefinder.yc_0;
import ttw.tradefinder.zc_2;
import velox.gui.colors.Colors;

/*
 * Renamed from ttw.tradefinder.QC
 */
public class qc_1
implements k_0 {
    private final JLabel d;
    private final Map<cd, ub_1> i;
    private final wa_1 e;
    private int k;
    private boolean B;
    private final Timer K;
    private BufferedImage E;
    private static final String j;
    private static final String a;
    private int h;
    private static byte[] H;
    private final fd_0 D;
    private static final String A;
    private final f_0 C;
    private BufferedImage M;
    private boolean b;
    private df_0<Ya, eo> c;

    private /* synthetic */ void d() {
        Iterator<ub_1> iterator;
        qc_1 a2;
        if (a2.c == null) {
            return;
        }
        qc_1 qc_12 = a2;
        qc_1 qc_13 = a2;
        a2.e.d();
        qc_13.D.j();
        qc_12.j("loading license....");
        String string = qc_13.a();
        Iterator<ub_1> iterator2 = iterator = qc_12.i.values().iterator();
        while (iterator2.hasNext()) {
            ub_1 ub_12 = iterator.next();
            ub_12.E(string);
            iterator2 = iterator;
            a2.D.E(ub_12);
        }
    }

    public /* synthetic */ String a() {
        qc_1 a2;
        if (a2.c == null) {
            return "XXXXXX-XXXXX-XXXXXX-XXXXX-XXXXXX";
        }
        String string = ((Ya)a2.c.M).c;
        if (H.length == 0) {
            return string;
        }
        return hd_1.j(string, H);
    }

    public /* synthetic */ void E(cd a2, i_0 a3) {
        qc_1 a4;
        if (a2 == cd.b) {
            return;
        }
        if (a4.i.containsKey((Object)a2)) {
            ub_1 ub_12 = a4.i.get((Object)a2);
            ub_12.E(a3);
            return;
        }
        ub_1 ub_13 = new ub_1(a4.a(), a2);
        ub_13.E(a3);
        qc_1 qc_12 = a4;
        qc_12.i.put(a2, ub_13);
        if (qc_12.c != null) {
            a4.D.E(ub_13);
        }
    }

    private static /* synthetic */ byte[] E() {
        String string = de_1.E();
        if (string.isEmpty()) {
            return new byte[0];
        }
        return hd_1.E(string);
    }

    static {
        a = "^[A-Za-z0-9\\-]{32}$";
        A = "wrong format of license id";
        j = "loading license....";
        H = qc_1.E();
    }

    private /* synthetic */ void j(sc_1 a2) {
        qc_1 a3;
        if (a3.c == null) {
            return;
        }
        JButton jButton = new JButton(new ImageIcon(a3.M));
        JPasswordField jPasswordField = new JPasswordField(0);
        jPasswordField.putClientProperty("JPasswordField.cutCopyAllowed", Boolean.TRUE);
        JPasswordField jPasswordField2 = jPasswordField;
        JPasswordField jPasswordField3 = jPasswordField;
        ne_1.E(jPasswordField3);
        jPasswordField3.setEchoChar('*');
        jPasswordField2.setHorizontalAlignment(0);
        String string = a3.a();
        jPasswordField2.setText(string);
        String string2 = a3.j();
        if (!string2.isEmpty() && !string.equals(string2)) {
            a3.d();
        }
        JPasswordField jPasswordField4 = jPasswordField;
        jPasswordField4.addFocusListener(new pb_1(a3, jPasswordField, jButton));
        jPasswordField4.addKeyListener(new ba_1(a3, jPasswordField));
        sc_1 sc_12 = a2;
        JButton jButton2 = jButton;
        jButton2.setSize(25, 25);
        jButton2.setBackground(Colors.TRANSPARENT);
        jButton2.addActionListener(new dc_0(a3, jPasswordField, jButton));
        sc_12.E(sc_12.a(new JLabel("License ID")));
        sc_12.E(sc_12.a((Component)jPasswordField, (Component)jButton));
    }

    public /* synthetic */ void a() {
        qc_1 a2;
        qc_1 qc_12 = a2;
        qc_12.c = qc_12.C.E(new Ya());
        qc_12.d();
    }

    public /* synthetic */ cd E() {
        qc_1 a2;
        return a2.e.E();
    }

    private /* synthetic */ void j(String a2) {
        qc_1 a3;
        SwingUtilities.invokeLater(new tb_1(a3, a2));
    }

    public /* synthetic */ void j() {
        qc_1 a2;
        if (a2.b) {
            return;
        }
        a2.b = true;
        new Thread(a2.D).start();
        a2.K.scheduleAtFixedRate((TimerTask)new qb_1(a2), Duration.ofSeconds(10L).toMillis(), Duration.ofMinutes(1L).toMillis());
    }

    public /* synthetic */ Collection<? extends sc_1> E(String a2, int a3) {
        qc_1 a4;
        qc_1 qc_12 = a4;
        qc_12.c = qc_12.C.E(new Ya());
        boolean bl = qc_12.C.E().E(cd.H);
        a2 = new sc_1((String)a2, String.format("%s %s", "TTW-TradeFinder", "3.7.1"), a3, false, xf_1.M, a4.C);
        qc_1 qc_13 = a4;
        Object object = a2;
        a4.E((sc_1)object);
        qc_13.j((sc_1)object);
        qc_13.E((sc_1)a2, bl);
        return Arrays.asList(a2);
    }

    @Override
    public /* synthetic */ void E(cd a2) {
        qc_1 a3;
        a3.j(zc_2.E(a2));
    }

    private /* synthetic */ String j() {
        qc_1 a2;
        Iterator<ub_1> iterator = a2.i.values().iterator();
        if (iterator.hasNext()) {
            iterator = iterator.next();
            iterator = ((ub_1)((Object)iterator)).E();
            ((String)((Object)iterator)).isEmpty();
            return iterator;
        }
        return "";
    }

    private /* synthetic */ void E(String a2) {
        qc_1 qc_12;
        qc_1 a3;
        if (a3.c == null) {
            return;
        }
        a3.C.E().E(a3.a(), a2);
        qc_1 qc_13 = a3;
        if (H.length == 0) {
            ((Ya)qc_13.c.M).c = a2;
            qc_12 = a3;
        } else {
            ((Ya)qc_13.c.M).c = hd_1.E(a2, H);
            qc_12 = a3;
        }
        qc_12.C.E(a3.c);
    }

    private /* synthetic */ void E(sc_1 a2) {
        qc_1 a3;
        if (a3.c == null) {
            return;
        }
        sb_1 sb_12 = new sb_1(a3.e.E(), a3.C.j());
        a3.e.E(sb_12);
        a2.E(new JLabel("Active License:"), (Component)a3.d, sb_12.E());
    }

    public /* synthetic */ void E() {
        Iterator<ub_1> iterator;
        qc_1 a2;
        qc_1 qc_12 = a2;
        qc_12.K.cancel();
        qc_12.D.E();
        qc_12.D.j();
        qc_12.D.E(ub_1.E());
        qc_12.e.E();
        Iterator<ub_1> iterator2 = iterator = qc_12.i.values().iterator();
        while (iterator2.hasNext()) {
            iterator.next().j();
            iterator2 = iterator;
        }
        a2.i.clear();
    }

    public /* synthetic */ void E(i_0 a2) {
        qc_1 a3;
        ArrayList<cd> arrayList = new ArrayList<cd>();
        for (Map.Entry<cd, ub_1> object : a3.i.entrySet()) {
            ub_1 ub_12 = object.getValue();
            ub_12.j(a2);
            if (ub_12.E() != 0) continue;
            arrayList.add(object.getKey());
        }
        Iterator<Map.Entry<cd, ub_1>> iterator = arrayList.iterator();
        Iterator<Object> iterator2 = iterator;
        while (iterator2.hasNext()) {
            cd cd2 = (cd)((Object)iterator.next());
            iterator2 = iterator;
            a3.i.remove((Object)cd2);
        }
    }

    public /* synthetic */ boolean E(cd a2) {
        qc_1 a3;
        if (a3.i.containsKey((Object)a2)) {
            return a3.i.get((Object)a2).j();
        }
        return false;
    }

    private /* synthetic */ void E(sc_1 a2, boolean a3) {
        qc_1 a4;
        qc_1 qc_12 = a4;
        qc_1 qc_13 = a4;
        sc_1 sc_12 = a2;
        qc_13.E(sc_12, "", false);
        qc_12.E(sc_12, qc_13.E("Trade and learn with us on Discord", "https://discord.gg/RZaHJM3"), false);
        qc_12.E(a2, "Check out our " + qc_12.E("educational videos", "https://ttwtrader.com/videos") + " and the " + a4.E("user manual", "https://wiki.ttwtrader.com/tradefinder"), true);
        qc_1 qc_14 = a4;
        qc_14.E(a2, "Download " + qc_14.E("instrument configuration files", "https://ttwtrader.com/instrument-configuration"), true);
        qc_1 qc_15 = a4;
        qc_15.E(a2, "Get the " + qc_15.E("latest version", "https://ttwtrader.com/ttw-tradefinder"), true);
        qc_1 qc_16 = a4;
        sc_1 sc_13 = a2;
        a4.E(sc_13, "", true);
        qc_16.E(sc_13, "Need help? We'll be happy to assist you.", true);
        qc_16.E(a2, "Contact us at " + qc_16.E("support@ttwtrader.com", "mailto:support@ttwtrader.com"), true);
        qc_1 qc_17 = a4;
        qc_17.E(a2, "", false);
        qc_17.E(a2, qc_17.C.E() + " 3.7.1" + (a3 ? " b3" : "") + " (JANUARY 2023)", true);
        a4.E(a2, "\u00a9 2023, TTW Trading Systems PTE. LTD.", false);
    }

    public /* synthetic */ qc_1(f_0 a2, wa_1 a3) {
        qc_1 qc_12;
        qc_1 a4;
        qc_1 qc_13 = a4;
        qc_1 qc_14 = a4;
        qc_1 qc_15 = a4;
        qc_1 qc_16 = a4;
        qc_1 qc_17 = a4;
        a4.i = new HashMap<cd, ub_1>();
        a4.K = new Timer();
        a4.d = new JLabel("loading license....");
        qc_17.c = null;
        qc_17.b = false;
        qc_16.B = false;
        qc_16.k = 0;
        qc_15.h = 0;
        qc_15.C = a2;
        qc_14.e = a3;
        qc_14.b = false;
        qc_13.k = 0;
        qc_13.h = 0;
        qc_13.D = new fd_0(a2);
        try {
            a4.M = ImageIO.read(ba_2.class.getClassLoader().getResourceAsStream("images/view.png"));
            a4.E = ImageIO.read(ba_2.class.getClassLoader().getResourceAsStream("images/hide.png"));
            qc_12 = a4;
        }
        catch (Exception exception) {
            qc_12 = a4;
            a4.M = new BufferedImage(1, 1, 2);
            a4.E = new BufferedImage(1, 1, 2);
        }
        qc_12.d.setFont(a4.d.getFont().deriveFont(1, 14.0f));
        qc_1 qc_18 = a4;
        a4.e.E((k_0)qc_18);
        qc_18.e.E(a4);
    }

    private /* synthetic */ String E(String a2, String a3) {
        return String.format("<a href='%s' style='color: white'>%s</a>", a3, a2);
    }

    public /* synthetic */ String E() {
        qc_1 a2;
        return a2.D.E();
    }

    private /* synthetic */ void E(sc_1 a2, String a32, boolean a4) {
        qc_1 a5;
        a32 = new JEditorPane("text/html", (String)a32);
        ((JTextComponent)a32).setEditable(false);
        Object object = a32;
        ((JComponent)object).setOpaque(false);
        ((JComponent)object).setFont(((Component)object).getFont().deriveFont(13.0f));
        ((JEditorPane)object).addHyperlinkListener(new yc_0(a5));
        int a32 = a2.E((Component)object);
        if (a4) {
            a2.E(a32);
        }
    }
}

