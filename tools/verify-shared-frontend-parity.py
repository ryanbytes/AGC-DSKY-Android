#!/usr/bin/env python3
import argparse
import hashlib
import os
import sys
import zipfile
from pathlib import Path

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def source_files(root: Path):
    out = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.name in {".DS_Store", ".self-contained-assets-note"}:
            continue
        out[path.relative_to(root).as_posix()] = path.read_bytes()
    return out

def compare_dir(source: Path, target: Path):
    src = source_files(source)
    missing, changed = [], []
    for rel, expected in src.items():
        got = target / rel
        if not got.is_file():
            missing.append(rel)
            continue
        actual = got.read_bytes()
        if actual != expected:
            changed.append((rel, digest(expected), digest(actual)))
    return missing, changed

def compare_apk(source: Path, apk: Path):
    src = source_files(source)
    missing, changed = [], []
    with zipfile.ZipFile(apk) as zf:
        names = set(zf.namelist())
        for rel, expected in src.items():
            member = f"assets/{rel}"
            if member not in names:
                missing.append(rel)
                continue
            actual = zf.read(member)
            if actual != expected:
                changed.append((rel, digest(expected), digest(actual)))
    return missing, changed

def main():
    ap = argparse.ArgumentParser(description="Verify packaged AGC DSKY shared frontend parity.")
    ap.add_argument("--source", required=True)
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--dir")
    group.add_argument("--apk")
    ap.add_argument("--label", default="target")
    args = ap.parse_args()

    source = Path(args.source).resolve()
    if not source.is_dir():
        raise SystemExit(f"PARITY FAIL [{args.label}]: source directory missing: {source}")

    if args.dir:
        target = Path(args.dir).resolve()
        if not target.is_dir():
            raise SystemExit(f"PARITY FAIL [{args.label}]: target directory missing: {target}")
        missing, changed = compare_dir(source, target)
    else:
        target = Path(args.apk).resolve()
        if not target.is_file():
            raise SystemExit(f"PARITY FAIL [{args.label}]: APK missing: {target}")
        missing, changed = compare_apk(source, target)

    if missing or changed:
        print(f"PARITY FAIL [{args.label}]")
        for rel in missing:
            print(f"  missing: {rel}")
        for rel, expected, actual in changed:
            print(f"  changed: {rel}")
            print(f"    source: {expected}")
            print(f"    target: {actual}")
        raise SystemExit(1)

    count = len(source_files(source))
    print(f"Shared frontend parity [{args.label}]: PASS")
    print(f"  {count} canonical assets byte-identical")

if __name__ == "__main__":
    main()
