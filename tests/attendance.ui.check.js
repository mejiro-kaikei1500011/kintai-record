// 勤怠ページの動作確認（jsdom）。実行: NODE_PATH=/tmp/domcheck/node_modules node tests/attendance.ui.check.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const dir = path.join(__dirname, "..");
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const logic = fs.readFileSync(path.join(dir, "logic.js"), "utf8");
html = html.replace('<script src="logic.js"></script>', () => `<script>${logic}</script>`);

const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/attendance/" });
const w = dom.window;
w.alert = (m) => { throw new Error("alert: " + m); };
w.confirm = () => true;
const $ = (id) => w.document.getElementById(id);

// 初期化後に、対象月を2026-06にして入力を行う
w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
$("month").value = "2026-06";
$("month").dispatchEvent(new w.Event("change"));

// 行の入力（時刻と休憩）
function setRow(date, field, value) {
  const tr = w.document.querySelector(`tr[data-date="${date}"]`);
  const input = tr.querySelector(`[data-k="${field}"]`);
  input.value = value;
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
}
setRow("2026-06-01", "in", "09:00");
setRow("2026-06-01", "out", "18:00");
setRow("2026-06-01", "brk", "60");
setRow("2026-06-02", "in", "09:00");
setRow("2026-06-02", "out", "20:00");
setRow("2026-06-02", "brk", "60");
setRow("2026-06-03", "in", "09:00");

const stored = JSON.parse(w.localStorage.getItem("attendance-v1"));
assert.deepStrictEqual(stored.days["2026-06-01"], { in: "09:00", out: "18:00", brk: "60" });
assert.strictEqual($("sumDays").textContent, "2");
assert.strictEqual($("sumHours").textContent, "18");
assert.strictEqual($("sumOt").textContent, "2");
assert.strictEqual($("sumMiss").textContent, "1");
assert.ok($("missMsg").textContent.includes("3日"));

// 行の休憩に数字以外が入っても数字だけを残す
setRow("2026-06-02", "brk", "60分");
assert.strictEqual(w.localStorage.getItem("attendance-v1").includes('"brk":"60"'), true);

// 空にすると日の記録が消える
setRow("2026-06-03", "in", "");
assert.strictEqual(JSON.parse(w.localStorage.getItem("attendance-v1")).days["2026-06-03"], undefined);

console.log("attendance.ui.check.js: all PASS");
