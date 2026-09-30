#!/usr/bin/env python3
import argparse, base64, hashlib, json
from pathlib import Path

def digest(data):
    return hashlib.sha256(data).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("patch")
    ap.add_argument("output")
    a=ap.parse_args()
    src=Path(a.source).read_bytes()
    p=json.loads(Path(a.patch).read_text())
    if p.get("v") != 1:
        raise SystemExit("unsupported patch version")
    got=digest(src)
    if got != p["source_sha256"]:
        raise SystemExit(f"source SHA-256 mismatch: {got}")
    out=bytearray()
    for op in p["ops"]:
        if op[0] == "c":
            off,n=op[1],op[2]
            if off < 0 or n < 0 or off+n > len(src):
                raise SystemExit("invalid copy operation")
            out += src[off:off+n]
        elif op[0] == "a":
            out += base64.b64decode(op[1], validate=True)
        else:
            raise SystemExit("invalid patch operation")
    if len(out) != p["target_size"]:
        raise SystemExit(f"target size mismatch: {len(out)}")
    got=digest(out)
    if got != p["target_sha256"]:
        raise SystemExit(f"target SHA-256 mismatch: {got}")
    Path(a.output).write_bytes(out)
    print(f"{a.output}: {got} ({len(out)} bytes)")

if __name__ == "__main__":
    main()
