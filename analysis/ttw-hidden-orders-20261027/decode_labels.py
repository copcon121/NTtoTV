"""Decode simple constant-XOR UI labels statically; do not execute addon code."""
import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent / "active-3.7.1" / "decompiled" / "ttw" / "tradefinder"
OUTPUT = ROOT.parents[2] / "decoded"


def number(expr):
    node = ast.parse(expr, mode="eval").body

    def visit(n):
        if isinstance(n, ast.Constant) and isinstance(n.value, int):
            return n.value
        if isinstance(n, ast.BinOp):
            a, b = visit(n.left), visit(n.right)
            operations = {ast.LShift: lambda: a << b, ast.RShift: lambda: a >> b,
                          ast.BitXor: lambda: a ^ b, ast.BitOr: lambda: a | b,
                          ast.BitAnd: lambda: a & b, ast.Add: lambda: a + b,
                          ast.Sub: lambda: a - b}
            return operations[type(n.op)]()
        raise ValueError(expr)
    return visit(node)


def java_string(raw):
    def escape(match):
        s = match.group(1)
        simple = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f",
                  "'": "'", '"': '"', "\\": "\\"}
        if s in simple:
            return simple[s]
        if s.startswith("u"):
            return chr(int(s[1:], 16))
        return chr(int(s, 8))
    return re.sub(r"\\(u[0-9a-fA-F]{4}|[0-7]{1,3}|.)", escape, raw)


def main():
    decoders = {}
    for path in ROOT.glob("*.java"):
        source = path.read_text(encoding="utf-8")
        match = re.search(r"(?:public|private) static[^\n]*String E\(Object object\).*?int n4 = (.*?);.*?int n6 = (.*?);.*?return new String", source, re.S)
        if match:
            decoders[path.stem] = (number(match[1]), number(match[2]))
    total = 0
    OUTPUT.mkdir(exist_ok=True)
    call = re.compile(r'\b([A-Za-z_$][\w$]*)\.E\("((?:\\.|[^"\\])*)"\)')
    for path in ROOT.glob("*.java"):
        count = 0
        def replace(match):
            nonlocal count
            if match[1] not in decoders:
                return match[0]
            keys = decoders[match[1]]
            encoded = java_string(match[2])
            decoded = "".join(chr(ord(c) ^ keys[(len(encoded) - i) % 2]) for i, c in enumerate(encoded))
            count += 1
            return json.dumps(decoded, ensure_ascii=True)
        result = call.sub(replace, path.read_text(encoding="utf-8"))
        (OUTPUT / path.name).write_text(result, encoding="utf-8")
        total += count
    print(json.dumps({"decoders": len(decoders), "labels_decoded": total, "output": str(OUTPUT)}))


if __name__ == "__main__":
    main()
