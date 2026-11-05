/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.ArrayUtils
 *  org.apache.commons.lang3.StringUtils
 *  velox.api.layer0.credentialscomponents.CredentialsCheckbox
 *  velox.api.layer0.credentialscomponents.CredentialsComponent
 *  velox.api.layer0.credentialscomponents.CredentialsDropdown
 *  velox.api.layer0.credentialscomponents.CredentialsFieldManager
 *  velox.api.layer0.credentialscomponents.CredentialsSerializationField
 *  velox.api.layer0.credentialscomponents.CredentialsTextField
 *  velox.api.layer0.credentialscomponents.MultiCredentialsComponent
 *  velox.api.layer1.common.Layer1GlobalStorage
 *  velox.api.layer1.settings.Layer1UserLicenseFieldsInterface
 */
package velox.api.layer1.providers;

import java.awt.Component;
import java.awt.Container;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;
import velox.api.layer0.credentialscomponents.CredentialsCheckbox;
import velox.api.layer0.credentialscomponents.CredentialsComponent;
import velox.api.layer0.credentialscomponents.CredentialsDropdown;
import velox.api.layer0.credentialscomponents.CredentialsFieldManager;
import velox.api.layer0.credentialscomponents.CredentialsSerializationField;
import velox.api.layer0.credentialscomponents.CredentialsTextField;
import velox.api.layer0.credentialscomponents.MultiCredentialsComponent;
import velox.api.layer1.common.Layer1GlobalStorage;
import velox.api.layer1.settings.Layer1UserLicenseFieldsInterface;
import velox.bookmap.ep;
import velox.rithmic.RithmicConfigurationManager;

public class RithmicFieldManager
implements CredentialsFieldManager,
Layer1UserLicenseFieldsInterface {
    private static TreeMap<String, f> b;
    private CredentialsTextField c;
    private CredentialsTextField d;
    private e e;
    private d f;
    private CredentialsCheckbox g;
    private c h;
    private a i;
    private CredentialsCheckbox j;
    private CredentialsCheckbox k;

    public void acceptUserLicenseFields(Map<String, String> map) {
        boolean bl = ep.a(map);
        this.c = new CredentialsTextField("username", true, "Username:", false);
        this.d = new CredentialsTextField("password", false, "Password:", true);
        this.e = new e("system", true, "System:", this.c(), bl, this);
        this.f = new d("gateway", false, "Gateway:", new String[0], this);
        this.g = new CredentialsCheckbox("pluginMode", false, "Plugin mode");
        this.h = new c("aggregateQuotes", false, "Aggregate quotes", "Sending quote updates no more than 4 times per second", this);
        this.i = new a(this.h, this.g);
        this.j = new CredentialsCheckbox("convertToMarketOnReject", false, "Convert order to Market on reject");
        this.k = new CredentialsCheckbox("convertBracketStopToMarketOnReject", false, "Bracket Stop Orders: Convert to Market on reject");
        Component[] componentArray = this.g.getCompoundComponent().getComponents();
        JCheckBox jCheckBox = (JCheckBox)Arrays.stream(componentArray).filter(component -> component instanceof JCheckBox).findFirst().get();
        jCheckBox.setToolTipText("Get data through R | Trader Pro running locally");
        jCheckBox.addActionListener(actionEvent -> {
            if (jCheckBox.isSelected()) {
                RithmicFieldManager.a(jCheckBox, "Please note that connecting to Rithmic in plugin mode requires the following:\n- R | Trader Pro is running on this computer\n- R | Trader Pro is connected with same credentials as used in Bookmap\n- R | Trader Pro has plugins enabled\n- Firewall is not blocking loopback connections from Bookmap to R | Trader Pro", "Plugin mode", "rithmicadapter-dont_ask-plugin_mode_note");
            }
        });
        this.c.addAlias("legacy.username", "username");
        this.d.addAlias("legacy.password", "password");
        this.e.addAlias("legacy.system", "system");
        this.f.addAlias("legacy.gateway", "gateway");
        this.i.addAlias("legacy.aggregateQuotes", "aggregateQuotes");
        this.i.addAlias("legacy.pluginMode", "pluginMode");
    }

    private static void a(Component component, String string, String string2, String string3) {
        if ("1".equals(Layer1GlobalStorage.get((String)string3))) {
            return;
        }
        JCheckBox jCheckBox = new JCheckBox("Don't show again");
        Object[] objectArray = new Object[]{string, new JLabel(" "), jCheckBox};
        JOptionPane.showMessageDialog(component, objectArray, string2, 1);
        boolean bl = jCheckBox.isSelected();
        if (bl) {
            Layer1GlobalStorage.set((String)string3, (String)"1");
        }
    }

    public static String a(String string, String string2, boolean bl) {
        String string3 = RithmicFieldManager.b.get((Object)string).a.get((Object)string2).a.get(bl);
        return string3;
    }

    public List<CredentialsComponent> getCredentialsComponents() {
        LinkedList<CredentialsComponent> linkedList = new LinkedList<CredentialsComponent>();
        linkedList.add((CredentialsComponent)this.c);
        linkedList.add((CredentialsComponent)this.d);
        linkedList.add((CredentialsComponent)this.e);
        linkedList.add((CredentialsComponent)this.f);
        linkedList.add((CredentialsComponent)this.i);
        linkedList.add((CredentialsComponent)this.j);
        linkedList.add((CredentialsComponent)this.k);
        return linkedList;
    }

    private String[] c() {
        return (String[])b.keySet().stream().toArray(String[]::new);
    }

    public String a() {
        return this.e.a();
    }

    public String b() {
        return this.f.a();
    }

    public void a(String string) {
        this.f.a(string);
    }

    public void b(String string) {
        this.h.a(string);
    }

    public boolean isConfigured(Map<String, CredentialsSerializationField> map) {
        CredentialsSerializationField credentialsSerializationField = map.get("username");
        CredentialsSerializationField credentialsSerializationField2 = map.get("password");
        return credentialsSerializationField != null && credentialsSerializationField2 != null && !StringUtils.isAnyBlank((CharSequence[])new CharSequence[]{credentialsSerializationField.getStringValue(), credentialsSerializationField2.getStringValue()});
    }

    static {
        String[] stringArray;
        b = new TreeMap();
        for (String string2 : stringArray = RithmicConfigurationManager.a()) {
            String[] stringArray2 = string2.split("\\|");
            String string3 = stringArray2[0];
            String string4 = stringArray2[1];
            boolean bl = "Aggregated".equals(stringArray2[2]);
            assert (bl || "Full".equals(stringArray2[2]));
            f f2 = b.computeIfAbsent(string3, string -> new f());
            b b2 = f2.a.computeIfAbsent(string4, string -> new b());
            b2.a.put(bl, string2);
        }
    }

    public static class e
    extends CredentialsDropdown {
        RithmicFieldManager a;

        public e(String string2, boolean bl, String string3, String[] stringArray, boolean bl2, RithmicFieldManager rithmicFieldManager) {
            super(string2, bl, string3, (String[])Arrays.stream(stringArray).filter(string -> bl2 || RithmicConfigurationManager.c(string)).toArray(String[]::new));
            this.a = rithmicFieldManager;
            if (!ArrayUtils.isEmpty((Object[])this.values)) {
                if (Arrays.stream(this.values).anyMatch(string -> string.equals("Rithmic Paper Trading"))) {
                    this.comboBox.setSelectedItem("Rithmic Paper Trading");
                } else {
                    this.comboBox.setSelectedIndex(0);
                }
                if (this.values.length == 1) {
                    this.comboBox.setEnabled(false);
                    this.comboBox.setToolTipText("Your license does not permit live trading");
                }
            }
            this.addSettingsChangedListener(() -> rithmicFieldManager.a(this.a()));
        }

        public String a() {
            return (String)this.comboBox.getSelectedItem();
        }
    }

    public static class d
    extends CredentialsDropdown {
        RithmicFieldManager a;

        public d(String string, boolean bl, String string2, String[] stringArray, RithmicFieldManager rithmicFieldManager) {
            super(string, bl, string2, stringArray);
            this.a = rithmicFieldManager;
            this.a(rithmicFieldManager.a());
            this.addSettingsChangedListener(() -> rithmicFieldManager.b(rithmicFieldManager.b()));
        }

        private void a(String string2) {
            this.comboBox.removeAllItems();
            Set<String> set = RithmicFieldManager.b.get((Object)string2).a.keySet();
            this.values = (String[])set.stream().toArray(String[]::new);
            this.isListening = false;
            set.forEach(string -> this.comboBox.addItem(string));
            this.isListening = true;
            if (set.contains("Chicago Area")) {
                this.comboBox.setSelectedItem("Chicago Area");
            }
        }

        public String a() {
            return (String)this.comboBox.getSelectedItem();
        }
    }

    public static class c
    extends CredentialsCheckbox {
        RithmicFieldManager a;

        public c(String string, boolean bl, String string2, String string3, RithmicFieldManager rithmicFieldManager) {
            super(string, bl, string2);
            this.a = rithmicFieldManager;
            this.checkBox.setToolTipText(string3);
            this.checkBox.setSelected(false);
        }

        public void a(String string) {
            String string2 = this.a.a();
            if (string2 == null || string == null) {
                return;
            }
            TreeMap<Boolean, String> treeMap = RithmicFieldManager.b.get((Object)string2).a.get((Object)string).a;
            if (treeMap.size() == 2) {
                this.checkBox.setEnabled(true);
            } else {
                this.checkBox.setEnabled(false);
                this.checkBox.setSelected(treeMap.containsKey(true));
            }
        }
    }

    public static class a
    extends MultiCredentialsComponent {
        private CredentialsCheckbox a;
        private CredentialsCheckbox b;

        public a(CredentialsCheckbox credentialsCheckbox, CredentialsCheckbox credentialsCheckbox2) {
            this.a = credentialsCheckbox;
            this.b = credentialsCheckbox2;
        }

        public void addSettingsChangedListener(Runnable runnable) {
            this.a.addSettingsChangedListener(runnable);
            this.b.addSettingsChangedListener(runnable);
        }

        public Map<String, CredentialsSerializationField> getValues() {
            HashMap<String, CredentialsSerializationField> hashMap = new HashMap<String, CredentialsSerializationField>();
            hashMap.putAll(this.a.getValues());
            hashMap.putAll(this.b.getValues());
            return hashMap;
        }

        public void setValues(Map<String, CredentialsSerializationField> map) {
            this.a.setValues(map);
            this.b.setValues(map);
        }

        public Container getCompoundComponent() {
            if (this.panel == null) {
                this.panel = new JPanel();
                GridBagLayout gridBagLayout = new GridBagLayout();
                gridBagLayout.columnWeights = new double[]{0.5, 0.5};
                this.panel.setLayout(gridBagLayout);
                GridBagConstraints gridBagConstraints = new GridBagConstraints();
                gridBagConstraints.anchor = 17;
                gridBagConstraints.insets = new Insets(15, 0, 0, 5);
                gridBagConstraints.gridx = 0;
                this.panel.add((Component)this.a(this.a), gridBagConstraints);
                GridBagConstraints gridBagConstraints2 = new GridBagConstraints();
                gridBagConstraints2.anchor = 17;
                gridBagConstraints2.insets = new Insets(15, 0, 0, 5);
                gridBagConstraints2.gridx = 1;
                this.panel.add((Component)this.a(this.b), gridBagConstraints2);
            }
            return this.panel;
        }

        private JCheckBox a(CredentialsCheckbox credentialsCheckbox) {
            Container container = credentialsCheckbox.getCompoundComponent();
            Component[] componentArray = container.getComponents();
            JCheckBox jCheckBox = null;
            for (Component component : componentArray) {
                if (!(component instanceof JCheckBox)) continue;
                jCheckBox = (JCheckBox)component;
            }
            return jCheckBox;
        }
    }

    public static class f {
        TreeMap<String, b> a = new TreeMap();
    }

    public static class b {
        TreeMap<Boolean, String> a = new TreeMap();
    }
}

