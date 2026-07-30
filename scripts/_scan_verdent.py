"""Deep scan Verdent extension.js for ALL fingerprinting/identification methods."""
import re, sys, os

ext_js = os.path.join(os.environ["USERPROFILE"], ".vscode", "extensions",
                      "verdentai.verdent-1.6.13", "dist", "extension.js")

if not os.path.exists(ext_js):
    print(f"ERROR: {ext_js} not found")
    sys.exit(1)

with open(ext_js, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

print(f"File size: {len(content):,} chars")
print()

# Patterns that indicate fingerprinting / system identification
patterns = {
    # Hardware/System IDs
    "hostname": r'.{0,120}hostname\(\).{0,120}',
    "os.arch": r'.{0,80}\.arch\(\).{0,80}',
    "os.platform": r'.{0,80}\.platform\(\).{0,80}',
    "os.release": r'.{0,80}\.release\(\).{0,80}',
    "os.type": r'.{0,80}\.type\(\).{0,80}',
    "os.totalmem": r'.{0,80}totalmem\(\).{0,80}',
    "os.cpus": r'.{0,80}\.cpus\(\).{0,80}',
    "os.networkInterfaces": r'.{0,100}networkInterfaces\(\).{0,100}',
    "MAC address": r'.{0,100}mac[_\-]?[Aa]ddress.{0,100}',
    "serial": r'.{0,80}serial[Nn]umber.{0,80}',
    "uuid/guid": r'.{0,80}system\.uuid.{0,80}',
    
    # Windows specific
    "wmic": r'.{0,100}wmic.{0,100}',
    "csproduct": r'.{0,100}csproduct.{0,100}',
    "BIOS": r'.{0,100}bios.{0,100}serial.{0,100}',
    "REG QUERY": r'.{0,150}REG\.exe.{0,150}',
    "diskdrive": r'.{0,100}diskdrive.{0,100}',
    
    # Crypto/hashing for fingerprints
    "createHash_sha256": r'.{0,60}createHash\("sha256"\).{0,120}',
    "createHash_md5": r'.{0,60}createHash\("md5"\).{0,120}',
    
    # Network/IP
    "ip_address": r'.{0,80}ip[_\-]?[Aa]ddress.{0,80}',
    "getIP": r'.{0,80}getIP.{0,80}',
    
    # VS Code env
    "vscode.env": r'.{0,60}env\.machineId.{0,60}',
    "sessionId": r'.{0,60}env\.sessionId.{0,60}',
    
    # Auth/signup specific
    "signup_url": r'.{0,100}signup.{0,100}device.{0,100}',
    "auth_params": r'.{0,200}challenge.{0,200}state.{0,200}',
    "verdentSrcKey": r'.{0,150}verdentSrcKey.{0,150}',
    "device_register": r'.{0,120}register.{0,60}device.{0,120}',
    
    # Telemetry endpoints
    "log.verdent": r'.{0,100}log\.verdent\.ai.{0,100}',
    "llm-proxy": r'.{0,100}llm-proxy\.verdent\.ai.{0,100}',
    "agent.verdent": r'.{0,100}agent\.verdent\.ai.{0,100}',
    
    # Fingerprint explicitly
    "fingerprint": r'.{0,120}fingerprint.{0,120}',
    "hardwareId": r'.{0,100}hardware[_\-]?[Ii]d.{0,100}',
    
    # userInfo
    "userInfo": r'.{0,100}userInfo\(\).{0,100}',
    
    # What gets sent during auth
    "auth_url_build": r'.{0,200}device_id.{0,60}app_version.{0,200}',
    "os_payload": r'.{0,60}os:\{.{0,300}',
}

for label, pattern in patterns.items():
    try:
        matches = re.findall(pattern, content)
    except:
        continue
    
    # Filter out noise
    unique = set()
    for m in matches:
        clean = m.strip().replace('\n', ' ')
        if len(clean) > 250:
            clean = clean[:250] + "..."
        unique.add(clean)
    
    if unique and len(unique) < 30:
        print(f"=== {label} ({len(unique)} unique) ===")
        for i, u in enumerate(sorted(unique)):
            if i >= 5:
                print(f"  ... and {len(unique)-5} more")
                break
            print(f"  {u}")
        print()
