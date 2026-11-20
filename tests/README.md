# Testseite für die TRS-Bodenstation

Die Anwendung `bodenstation.html` enthält bewusst **keinen Simulationsmodus** und keine Testdaten.
Für Tests ohne Empfänger-Hardware wird eine separate Testkopie erzeugt, in der `navigator.serial`
durch einen nachgebildeten USB-Port ersetzt ist.

## Testseite erzeugen und öffnen

```bash
python3 tests/build_harness.py
python3 -m http.server 8765 --bind 127.0.0.1 --directory tests
```

Dann `http://127.0.0.1:8765/harness.html` in Chrome öffnen, **Verbinden → USB-Empfänger auswählen**.
`tests/harness.html` wird bei jedem Aufruf neu erzeugt und nicht versioniert.

## Hilfsfunktionen in der Browser-Konsole

| Aufruf | Wirkung |
| --- | --- |
| `__push(__base({seq: 1}))` | Ein startbereites Paket senden (Felder per Objekt überschreibbar) |
| `__push('kein json')` | Beliebige Rohzeile senden |
| `__raw(new Uint8Array([0xff, 0x0a]))` | Rohe Bytes senden |
| `__testflug()` | Testflug (10 Hz, Datenlücke 20–23,5 s) auf einmal senden |
| `__unplug()` / `__unplug(false)` | Empfänger abziehen, mit bzw. ohne `disconnect`-Ereignis |
| `__replug()` | Empfänger wieder anstecken |
| `__t13live({seconds: 30})` | Testdaten im Format t13_live (Flugcomputer direkt am USB): imu 25/s mit drehender Lage, baro, analog, gps ohne Koordinaten, info. Rückgabe: Stoppfunktion |

Pakete gelten nur als aktuell, wenn sie höchstens 2 s alt sind; für Live-Zustände z. B.
`setInterval(() => __push(__base({seq: n++})), 300)` verwenden.

## Prüfliste nach Änderungen

- Desktop (≈ 1440 px), Tablet (≈ 900 px) und Handy (375 px), jeweils hell, dunkel und Feldmodus
- Leerzustand, aktuelle Daten, veraltete Daten (> 2 s), Datenlücken in den Diagrammen
- Browser-Konsole fehlerfrei
- Lokale Sicherung: Die Testseite legt eine IndexedDB `trs-bodenstation` für `127.0.0.1:8765` an;
  danach mit `indexedDB.deleteDatabase('trs-bodenstation')` entfernen.

## Echter Flugcomputer (t13_live)

Der eingebaute Browser der Claude-App kann keine USB-Geräte auswählen. Echte Tests der Live-Ansicht daher in Chrome:
`bodenstation.html` öffnen, **Verbinden**, das Gerät „Pico“ / TSR mini wählen. Referenz flach liegend: a ≈ (0, 0, 1) g, Neigung ≈ 90°.
Niemals 1200 Baud verwenden (Bootloader); die Oberfläche lässt nur 57.600, 115.200 und 230.400 Baud zu.
