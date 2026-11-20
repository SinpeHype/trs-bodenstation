// TRS Bodenstation – Testhilfe. Wird NIE mit der Anwendung ausgeliefert.
// Ersetzt navigator.serial durch einen nachgebildeten USB-Port, damit die
// Oberfläche ohne Empfänger-Hardware geprüft werden kann. Alle Daten, die hier
// erzeugt werden, sind Testdaten und gehören ausschließlich in diese Testseite.
(function () {
  'use strict';
  let controller = null;
  let plugged = true;
  let isOpen = false;
  const encoder = new TextEncoder();

  const port = {
    readable: null,
    getInfo: () => ({ usbVendorId: 0x2e8a, usbProductId: 0x000a }),
    async open() {
      if (!plugged) throw new DOMException('Gerät nicht vorhanden', 'NetworkError');
      if (isOpen) throw new DOMException('Port bereits geöffnet', 'InvalidStateError');
      isOpen = true;
      port.readable = new ReadableStream({ start(c) { controller = c; } });
    },
    async close() { isOpen = false; port.readable = null; },
    async setSignals(signals) { window.__signals = Object.assign(window.__signals || {}, signals); }
  };

  const serial = new EventTarget();
  serial.requestPort = async () => port;
  serial.getPorts = async () => (plugged ? [port] : []);
  Object.defineProperty(Navigator.prototype, 'serial', { get() { return serial; }, configurable: true });

  /** Sendet ein Objekt (als JSON) oder eine Rohzeile an die Bodenstation. */
  window.__push = obj => controller.enqueue(encoder.encode((typeof obj === 'string' ? obj : JSON.stringify(obj)) + '\n'));
  /** Sendet beliebige Bytes, z. B. new Uint8Array([0xff, 0x0a]). */
  window.__raw = bytes => controller.enqueue(bytes);
  /** Zieht den Empfänger ab: Lesefehler und optional ein disconnect-Ereignis. */
  window.__unplug = (withEvent = true) => {
    plugged = false;
    try { controller.error(new DOMException('Gerät getrennt', 'NetworkError')); } catch { /* bereits beendet */ }
    if (withEvent) { const e = new Event('disconnect'); e.port = port; serial.dispatchEvent(e); }
  };
  /** Steckt den Empfänger wieder an (connect-Ereignis). */
  window.__replug = () => { plugged = true; const e = new Event('connect'); e.port = port; serial.dispatchEvent(e); };

  /** Grundpaket mit allen Feldern in startbereitem Zustand. */
  window.__base = (overrides = {}) => Object.assign({
    type: 'telemetry', protocol: 1, integrity_ok: true, device_id: 'TEST-FC', flight_id: 'T-001', seq: 0,
    phase: 'ready', flight_time_s: 0, altitude_m: 0.2, velocity_m_s: 0, acceleration_g: 0,
    pressure_hpa: 1013.2, accel_x_g: 0, accel_y_g: 0, accel_z_g: 1, battery_v: 3.95, satellites: 9, gps_fix: 3,
    hdop: 1.1, lat: 52.39, lon: 13.07, rssi_dbm: -62, snr_db: 9.5, flash_free_pct: 88, logging_hz: 100,
    frequency_mhz: 868.1, pyro2_height_m: 150, apogee_delay_ms: 500, baro_ok: true, imu_ok: true,
    main_switch: true, armed_switch: true, pyro1_continuity: true, pyro2_continuity: true,
    pyro1_fired: false, pyro2_fired: false, profile_id: 'TRS-FC-01', fw_version: '0.1.0-test'
  }, overrides);

  /**
   * Erzeugt einen vereinfachten Testflug mit 10 Hz und optionaler Datenlücke.
   * Gibt die Pakete zurück; mit send=true werden sie sofort gesendet.
   */
  window.__testflug = ({ startSeq = 1000, gap = [20, 23.5], send = true, flightId = 'T-001' } = {}) => {
    const packets = [];
    let seq = startSeq;
    for (let i = 1; i <= 700; i++) {
      const t = i / 10;
      if (gap && t > gap[0] && t < gap[1]) continue;
      let phase, alt, vel, acc;
      if (t < 2.5) { phase = 'boost'; acc = 30 * Math.sin(Math.PI * t / 2.5); vel = 116 * t; alt = 58 * t * t; }
      else if (t < 14) { phase = 'coast'; const tc = t - 2.5; vel = Math.max(0, 290 - 25.2 * tc); acc = -2.6; alt = 362 + 290 * tc - 12.6 * tc * tc; }
      else if (t < 14.7) { phase = 'apogee'; vel = -1; acc = -1; alt = 1650; }
      else if (t < 69.5) { phase = 'descent'; vel = -29; acc = 0.1; alt = Math.max(0, 1650 - (t - 14.7) * 30); }
      else { phase = 'landed'; vel = 0; acc = 0; alt = 0; }
      packets.push(window.__base({
        seq: seq++, flight_id: flightId, phase, flight_time_s: Math.round(t * 10) / 10, altitude_m: alt,
        velocity_m_s: vel, acceleration_g: acc, lat: 52.39 + t * 0.00002, lon: 13.07 + t * 0.00003,
        pyro1_fired: t >= 14.6, pyro2_fired: alt <= 150 && t > 20
      }));
    }
    if (send) packets.forEach(p => window.__push(p));
    return packets;
  };

  /**
   * Testdaten im Format von t13_live (Flugcomputer direkt am USB, Protokoll v1).
   * Sendet in Echtzeit: imu 25/s mit langsam drehender Lage, baro 10/s, analog 2/s,
   * gps 1/s (ohne Koordinaten), info beim Start und alle 10 s. Rückgabe: Stoppfunktion.
   */
  window.__t13live = ({ seconds = 30, rotate = true } = {}) => {
    const start = performance.now();
    let n = 0;
    const tMs = () => Math.round(420000 + performance.now() - start);
    const send = obj => window.__push(Object.assign({ v: 1, t_ms: tMs() }, obj));
    let gyroAuto = 'wartet auf Stillstand';
    const info = anlass => send({ typ: 'info', anlass, kalib_gyro_auto: gyroAuto, programm: 't13_live', firmware: 'Testseite', chip_id: 'TEST000000000000',
      rom_version: 4, imu_ok: true, imu_who_am_i: 108, baro_ok: true, baro_crc_ok: true, flash_ok: true, flash_jedec: 'EF 40 18',
      lora_ok: true, lora_status: 34, lora_fehler: 0, lora_modus: 'nur Status, sendet nie', achsen: '+X Spitze', welt: 'Z oben',
      kalib_gyro_x: 0.078, kalib_gyro_y: -0.255, kalib_gyro_z: 0.136, kalib_p0_hpa: 995.79, kalib_vbat_faktor: 1.0 });
    info('verbunden');
    const timer = setInterval(() => {
      n++;
      const t = (performance.now() - start) / 1000;
      // Lage: Drehung um Welt-Z (Gier) und langsames Aufrichten der Spitze (Pitch)
      const yaw = rotate ? t * 0.6 : 0, pitch = rotate ? -Math.min(Math.PI / 2, t * 0.15) : 0;
      const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
      const q = { qw: cy * cp, qx: -sy * sp, qy: cy * sp, qz: sy * cp };
      const tilt = 90 + pitch * 180 / Math.PI;
      send({ typ: 'imu', ax_g: Math.sin(t * 3) * 0.05, ay_g: Math.cos(t * 2) * 0.04, az_g: 1.0 + Math.sin(t) * 0.02,
        a_betrag_g: 1.0, a_senkrecht_g: 0.01, gx_dps: Math.sin(t) * 3, gy_dps: rotate ? -8.6 : 0, gz_dps: rotate ? 34.4 : 0,
        gx_roh_dps: 0.1, gy_roh_dps: -0.3, gz_roh_dps: 0.1, temp_c: 24.9, ...q, neigung_grad: Math.round(tilt * 10) / 10,
        roll_grad: 0, pitch_grad: Math.round(pitch * 1800 / Math.PI) / 10, gier_grad: Math.round(((yaw * 180 / Math.PI) % 360) * 10) / 10, rate_hz: 101 });
      if (n % 3 === 0) send({ typ: 'baro', druck_hpa: 996.1, temp_c: 23.7, hoehe_m: -2.68 + Math.sin(t) * 0.1, hoehe_gefiltert_m: -2.13,
        steigrate_ms: -0.02, p0_hpa: 995.79, d1: 9191026, d2: 8335360 });
      if (n % 13 === 0) send({ typ: 'analog', vbat_v: 0.01, akku_erkannt: false, pyro1_v: 0.14, pyro2_v: 0.13, pyro1_verhaeltnis: null, pyro2_verhaeltnis: null });
      if (n % 25 === 0) send({ typ: 'gps', fix: true, fix_qualitaet: 1, satelliten: 8, sichtbar: 11, hdop: 1.0, breite: null, laenge: null,
        hoehe_m: 104.4, utc: '231337.000', datum: '201126', saetze_ok: 3355 + n, pruefsummenfehler: 0, bytes: 200269 + n * 80 });
      if (n === 50) { gyroAuto = 'automatisch beim Start'; info('gyro_auto'); }
      if (n % 250 === 0) info('regelmaessig');
      if (t > seconds) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  };
})();
