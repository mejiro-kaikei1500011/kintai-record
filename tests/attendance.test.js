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

// 支給額：時給1200円、所定内18時間−時間外2時間＝16時間 → 19,200円、時間外 2時間×1.25×1200＝3,000円
const pay = A.payOf("1200", s);
assert.strictEqual(pay.normal, 19200);
assert.strictEqual(pay.overtime, 3000);
assert.strictEqual(pay.total, 22200);
assert.strictEqual(A.payOf("", s).total, 0);

// LINE用の文章：記号の装飾なし、支給見込みを含む
const line = A.toLineText("山田 太郎", days, "2026-06", "1200");
assert.ok(line.startsWith("山田 太郎 2026年6月分 勤怠"));
assert.ok(line.includes("支給見込み 22,200円"));
assert.ok(line.includes("6/2（火） 09:00〜20:00 休憩60分 実働10時間"));
assert.ok(!/[#*|]/.test(line));
// 記録のない日も日付だけ出る（6月は30日まで）
assert.ok(line.includes("6/30（火）"));
assert.strictEqual(line.split("\n").filter((l) => /^6\/\d+（/.test(l)).length, 30);
assert.ok(!A.toLineText("", days, "2026-06", "").includes("支給見込み"));

// 日数の数え方（2026年2月は28日まで）
assert.strictEqual(A.datesOf("2026-02").length, 28);
assert.strictEqual(A.datesOf("2026-02").slice(-1)[0], "2026-02-28");

// CSV：BOM・ヘッダー・日付行
const csv = A.toCsv(days, "2026-06");
assert.ok(csv.startsWith("﻿日付,曜日,出勤,退勤,休憩(分),実働(時間),時間外(時間)"));
assert.ok(csv.includes("2026-06-02,火,09:00,20:00,60,10,2"));
assert.ok(csv.includes("2026-06-03,水,09:00,,,,"));

console.log("attendance.test.js: all PASS");
