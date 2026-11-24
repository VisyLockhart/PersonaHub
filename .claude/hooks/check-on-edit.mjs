// PostToolUse hook（D-0008）：Claude 編輯檔案後自動跑 CONVENTIONS §2 的檢查。
// - .js：node --input-type=module --check
// - manifest.json：JSON 解析
// 失敗以 exit 2 回給 Claude 當場修；其他檔案略過。
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const filePath = input?.tool_input?.file_path;
if (!filePath || !existsSync(filePath)) process.exit(0);

const name = path.basename(filePath);
const ext = path.extname(filePath).toLowerCase();

function fail(msg) {
  process.stderr.write(msg.trim() + "\n");
  process.exit(2);
}

if (ext === ".js") {
  const r = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    input: readFileSync(filePath, "utf8"),
    encoding: "utf8",
  });
  if (r.status !== 0) fail(`語法錯誤：${filePath}\n${r.stderr ?? ""}${r.error ?? ""}`);
} else if (name === "manifest.json") {
  try {
    JSON.parse(readFileSync(filePath, "utf8"));
  } catch (e) {
    fail(`manifest.json 無法解析：${e.message}`);
  }
}
process.exit(0);
