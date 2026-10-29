"""Read-only ZIP/class inventory; never load or execute addon code."""
import argparse
import hashlib
import json
import re
import struct
import zipfile
from pathlib import Path


def utf8_constants(data):
    if data[:4] != b"\xca\xfe\xba\xbe":
        return []
    count = struct.unpack_from(">H", data, 8)[0]
    offset, index, strings = 10, 1, []
    lengths = {3: 4, 4: 4, 5: 8, 6: 8, 7: 2, 8: 2, 9: 4,
               10: 4, 11: 4, 12: 4, 15: 3, 16: 2, 17: 4, 18: 4,
               19: 2, 20: 2}
    while index < count:
        tag = data[offset]
        offset += 1
        if tag == 1:
            length = struct.unpack_from(">H", data, offset)[0]
            offset += 2
            strings.append(data[offset:offset + length].decode("utf-8", "replace"))
            offset += length
        else:
            offset += lengths[tag]
        index += 2 if tag in (5, 6) else 1
    return strings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("jar")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    source = Path(args.jar).resolve()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    pattern = re.compile(r"hidden|iceberg|replen|reload|absorp|order.?id|trade.?id|native|synthetic|onTrade|onDepth|onMbo", re.I)
    inventory, hits = [], []
    with zipfile.ZipFile(source) as jar:
        for item in jar.infolist():
            raw = jar.read(item)
            inventory.append({"name": item.filename, "size": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
            if item.filename.endswith(".class"):
                matched = [s for s in utf8_constants(raw) if pattern.search(s)]
                if matched:
                    hits.append({"class": item.filename, "strings": matched})
        manifest = jar.read("META-INF/MANIFEST.MF").decode("utf-8", "replace")
    identity = {"path": str(source), "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                "entries": len(inventory), "manifest": manifest}
    (out / "identity.json").write_text(json.dumps(identity, indent=2), encoding="utf-8")
    (out / "inventory.json").write_text(json.dumps(inventory, indent=2), encoding="utf-8")
    (out / "feature-strings.json").write_text(json.dumps(hits, indent=2), encoding="utf-8")
    print(json.dumps(identity, indent=2))
    print(json.dumps(hits, indent=2))


if __name__ == "__main__":
    main()
