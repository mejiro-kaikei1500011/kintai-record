// 勤怠の計算の検算
const assert = require("assert");
const A = require("../logic.js");

// 時刻の変換
assert.strictEqual(A.toMin("09:00"), 540);
assert.strictEqual(A.toMin(""), null);
assert.strictEqual(A.toMin("9:60"), null);

// 通常の1日：9:00〜18:00、休憩60分 → 実働480分、時間外0
assert.deepStrictEqual(
  A.dayWork({ in: "09:00", out: "18:00", brk: 60 }),
  { worked: true, work: 480, ot: 0, missing: false }
);

// 残業あり：9:00〜20:00、休憩60分 → 実働600分、時間外120分
assert.deepStrictEqual(
  A.dayWork({ in: "09:00", out: "20:00", brk: "60" }),
  { worked: true, work: 600, ot: 120, missing: false }
);

// 深夜をまたぐ：22:00〜02:00、休憩0 → 実働240分
assert.strictEqual(A.dayWork({ in: "22:00", out: "02:00" }).work, 240);

// 片方だけの日は missing になり、実働に入らない
const half = A.dayWork({ in: "09:00" });
assert.strictEqual(half.worked, false);
assert.strictEqual(half.missing, true);

// 月次集計：6月（30日）に3日分入力、1日だけ退勤漏れ
const ym = "2026-06";
const days = {
  "2026-06-01": { in: "09:00", out: "18:00", brk: 60 },
  "2026-06-02": { in: "09:00", out: "20:00", brk: 60 },
  "2026-06-03": { in: "09:00" }
};
const s = A.monthSummary(days, ym);
assert.strictEqual(s.days, 2);
assert.strictEqual(s.workMin, 1080);
assert.strictEqual(s.otMin, 120);
assert.strictEqual(s.hours, 18);
assert.strictEqual(s.otHours, 2);
assert.deepStrictEqual(s.missing, ["2026-06-03"]);

// 日数の数え方（2026年2月は28日まで）
assert.strictEqual(A.datesOf("2026-02").length, 28);
assert.strictEqual(A.datesOf("2026-02").slice(-1)[0], "2026-02-28");

// CSV：BOM・ヘッダー・日付行
const csv = A.toCsv(days, "2026-06");
assert.ok(csv.startsWith("﻿日付,曜日,出勤,退勤,休憩(分),実働(時間),時間外(時間)"));
assert.ok(csv.includes("2026-06-02,火,09:00,20:00,60,10,2"));
assert.ok(csv.includes("2026-06-03,水,09:00,,,,"));

console.log("attendance.test.js: all PASS");
