// 勤怠の計算（画面に依存しない純粋な関数。テストから読み込む）
(function (root) {
  "use strict";
  const STD_MIN = 480; // 所定の1日の労働時間（8時間）を超えた分を時間外とみなす

  // "HH:MM" を分に変換する。空や不正な値は null
  function toMin(t) {
    if (!/^\d{1,2}:\d{2}$/.test(String(t || ""))) return null;
    const [h, m] = t.split(":").map(Number);
    if (h > 47 || m > 59) return null;
    return h * 60 + m;
  }

  // 1日の実働・時間外（分）。退勤が出勤より前なら翌日の退勤とみなす（深夜勤務）
  function dayWork(d) {
    const inM = toMin(d && d.in);
    const outM = toMin(d && d.out);
    if (inM === null || outM === null) return { worked: false, work: 0, ot: 0, missing: inM !== null || outM !== null };
    let span = outM - inM;
    if (span < 0) span += 1440;
    const brk = Math.max(0, Number(d.brk) || 0);
    const work = Math.max(0, span - brk);
    return { worked: true, work, ot: Math.max(0, work - STD_MIN), missing: false };
  }

  // 月の日付一覧（YYYY-MM-DD）
  function datesOf(ym) {
    const [y, m] = ym.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const out = [];
    for (let i = 1; i <= last; i++) out.push(`${ym}-${String(i).padStart(2, "0")}`);
    return out;
  }

  // 月の集計。missing は出勤か退勤の片方だけ入っている日
  function monthSummary(days, ym) {
    let count = 0, workMin = 0, otMin = 0;
    const missing = [];
    for (const date of datesOf(ym)) {
      const r = dayWork((days || {})[date]);
      if (r.worked) { count++; workMin += r.work; otMin += r.ot; }
      if (r.missing) missing.push(date);
    }
    return { days: count, workMin, otMin, hours: round2(workMin / 60), otHours: round2(otMin / 60), missing };
  }

  function round2(x) { return Math.round(x * 100) / 100; }

  // 書き出し用のCSV（Excelで開ける。BOM付きUTF-8）
  function toCsv(days, ym) {
    const lines = ["日付,曜日,出勤,退勤,休憩(分),実働(時間),時間外(時間)"];
    const wk = ["日", "月", "火", "水", "木", "金", "土"];
    for (const date of datesOf(ym)) {
      const d = (days || {})[date] || {};
      const r = dayWork(d);
      const w = wk[new Date(date + "T00:00:00").getDay()];
      lines.push([
        date, w, d.in || "", d.out || "", d.brk || "",
        r.worked ? round2(r.work / 60) : "", r.worked ? round2(r.ot / 60) : ""
      ].join(","));
    }
    return "﻿" + lines.join("\r\n") + "\r\n";
  }

  const api = { toMin, dayWork, datesOf, monthSummary, toCsv, STD_MIN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AttendanceLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
