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

  // 支給額の概算（時給×時間。時間外は割増1.25倍）。社会保険料・税金は引かない
  function payOf(hourly, s) {
    const h = Number(String(hourly || "").replace(/,/g, "")) || 0;
    const normalMin = s.workMin - s.otMin;
    const normal = Math.round(h * normalMin / 60);
    const overtime = Math.round(h * 1.25 * s.otMin / 60);
    return { hourly: h, normal, overtime, total: normal + overtime };
  }

  // LINEに貼り付ける用の文章（記号の装飾なし、1日1行）
  function toLineText(name, days, ym, hourly) {
    const s = monthSummary(days, ym);
    const p = payOf(hourly, s);
    const [y, m] = ym.split("-").map(Number);
    const wk = ["日", "月", "火", "水", "木", "金", "土"];
    const out = [];
    out.push(`${name || "名前未入力"} ${y}年${m}月分 勤怠`);
    out.push(`出勤日数 ${s.days}日`);
    out.push(`労働時間 ${s.hours}時間`);
    out.push(`時間外 ${s.otHours}時間`);
    if (p.hourly > 0) {
      out.push(`時給 ${p.hourly.toLocaleString("ja-JP")}円`);
      out.push(`所定内 ${p.normal.toLocaleString("ja-JP")}円 ／ 時間外 ${p.overtime.toLocaleString("ja-JP")}円`);
      out.push(`支給見込み ${p.total.toLocaleString("ja-JP")}円（税金・社会保険料は含みません）`);
    }
    if (s.missing.length) {
      out.push(`未入力の日 ${s.missing.map((d) => Number(d.slice(8)) + "日").join("、")}（出勤か退勤が未入力）`);
    }
    out.push("");
    for (const date of datesOf(ym)) {
      const d = (days || {})[date] || {};
      if (!d.in && !d.out) continue;
      const dd = new Date(date + "T00:00:00");
      const head = `${dd.getMonth() + 1}/${dd.getDate()}（${wk[dd.getDay()]}）`;
      if (d.in && d.out) {
        const r = dayWork(d);
        const brk = Number(d.brk) > 0 ? ` 休憩${Number(d.brk)}分` : "";
        out.push(`${head} ${d.in}〜${d.out}${brk} 実働${round2(r.work / 60)}時間`);
      } else {
        out.push(`${head} ${d.in ? "出勤 " + d.in : "退勤 " + d.out}（未入力あり）`);
      }
    }
    return out.join("\n");
  }

  const api = { toMin, dayWork, datesOf, monthSummary, payOf, toCsv, toLineText, STD_MIN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AttendanceLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
