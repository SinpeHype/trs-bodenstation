#!/usr/bin/env python3
"""Erzeugt tests/harness.html: bodenstation.html plus nachgebildeter USB-Port.

Die ausgelieferte bodenstation.html bleibt unverändert. harness.html ist eine
reine Testkopie und wird nicht versioniert (siehe .gitignore).

Aufruf:  python3 tests/build_harness.py
Danach:  python3 -m http.server 8765 --bind 127.0.0.1 --directory tests
         und http://127.0.0.1:8765/harness.html in Chrome öffnen.
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP = HERE.parent / "bodenstation.html"
MOCK = HERE / "serial-mock.js"
OUT = HERE / "harness.html"

source = APP.read_text(encoding="utf-8")
mock = MOCK.read_text(encoding="utf-8")
if "<head>" not in source:
    raise SystemExit("bodenstation.html enthält kein <head>-Tag")
banner = "<!-- TESTSEITE: enthält einen nachgebildeten USB-Port. Nicht für den Einsatz. -->"
OUT.write_text(source.replace("<head>", f"<head>{banner}<script>{mock}</script>", 1), encoding="utf-8")
print(f"Erzeugt: {OUT}")
