import { Router, Request, Response } from "express";
import multer from "multer";
import { parse as csvParse } from "csv-parse/sync";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function parseDate(val: any): Date | null {
  if (!val) return null;
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d;
  const ts = Number(val);
  if (!isNaN(ts)) {
    return ts > 1e10 ? new Date(ts) : new Date(ts * 1000);
  }
  return null;
}

function startOfDay() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return d;
}

function detectSeparator(sample: string): string {
  const counts = { ",": 0, "\t": 0, "|": 0, ";": 0 };
  for (const ch of Object.keys(counts) as (keyof typeof counts)[]) {
    counts[ch] = (sample.match(new RegExp(`\\${ch}`, "g")) || []).length;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function findField(headers: string[], candidates: string[]): string | null {
  for (const c of candidates) {
    const h = headers.find((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "") === c.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (h) return h;
  }
  return null;
}

function parseRows(content: string, ext: string): Record<string, any>[] {
  const lower = ext.toLowerCase();
  if (lower === "json") {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  if (lower === "tsv") {
    const rows = csvParse(content, { delimiter: "\t", columns: true, skip_empty_lines: true, relax_quotes: true });
    return rows as Record<string, any>[];
  }

  if (lower === "txt") {
    const sample = content.slice(0, 2000);
    const sep = detectSeparator(sample);
    const rows = csvParse(content, { delimiter: sep, columns: true, skip_empty_lines: true, relax_quotes: true });
    return rows as Record<string, any>[];
  }

  // Default: CSV
  const rows = csvParse(content, { delimiter: ",", columns: true, skip_empty_lines: true, relax_quotes: true });
  return rows as Record<string, any>[];
}

function buildAnalytics(rows: Record<string, any>[]) {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  const createdAtField = findField(headers, ["createdAt", "created_at", "joinedAt", "joined_at", "registeredAt", "date", "timestamp", "time"]);
  const lastActiveField = findField(headers, ["lastActive", "last_active", "lastSeen", "last_seen", "updatedAt", "updated_at", "lastInteraction"]);
  const blockedField = findField(headers, ["isBlocked", "blocked", "banned", "isBanned", "is_blocked", "is_banned"]);
  const botIdField = findField(headers, ["botId", "bot_id", "botName", "bot_name", "bot"]);
  const userIdField = findField(headers, ["userId", "user_id", "id", "_id", "uid", "telegramId", "telegram_id"]);

  const todayStart = startOfDay();
  const sevenDaysAgo = daysAgo(7);
  const yesterdayStart = daysAgo(1);

  let todayNew = 0, active7d = 0, todayActive = 0, blocked = 0, yesterdayNew = 0;
  const userBotMap: Record<string, Set<string>> = {};
  const botSet = new Set<string>();
  const dailyCounts: Record<string, number> = {};

  for (let i = 13; i >= 0; i--) {
    const d = daysAgo(i);
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dailyCounts[key] = 0;
  }

  for (const row of rows) {
    const createdAt = createdAtField ? parseDate(row[createdAtField]) : null;
    const lastActive = lastActiveField ? parseDate(row[lastActiveField]) : null;
    const isBlocked = blockedField ? (row[blockedField] === true || row[blockedField] === "true" || row[blockedField] === "1" || row[blockedField] === "yes") : false;
    const botId = botIdField ? String(row[botIdField] ?? "") : "";
    const userId = userIdField ? String(row[userIdField] ?? "") : "";

    if (createdAt) {
      if (createdAt >= todayStart) todayNew++;
      if (createdAt >= yesterdayStart && createdAt < todayStart) yesterdayNew++;

      for (let i = 13; i >= 0; i--) {
        const dayStart = daysAgo(i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        if (createdAt >= dayStart && createdAt < dayEnd) {
          const key = dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          dailyCounts[key] = (dailyCounts[key] ?? 0) + 1;
          break;
        }
      }
    }

    if (lastActive) {
      if (lastActive >= sevenDaysAgo) active7d++;
      if (lastActive >= todayStart) todayActive++;
    }

    if (isBlocked) blocked++;

    if (userId && botId) {
      if (!userBotMap[userId]) userBotMap[userId] = new Set();
      userBotMap[userId].add(botId);
      botSet.add(botId);
    }
  }

  const unique = rows.length;
  const common = Object.values(userBotMap).filter((s) => s.size > 1).length;
  const active7dPercent = unique > 0 ? Math.round((active7d / unique) * 100) : 0;
  const growthPercent = yesterdayNew > 0 ? Math.round(((todayNew - yesterdayNew) / yesterdayNew) * 100) : null;
  const dailyNewUsers = Object.entries(dailyCounts).map(([day, users]) => ({ day, users }));

  return {
    todayNew, unique, active7d, todayActive, common, blocked,
    posts: botSet.size, batches: 0, convLinks: 0,
    growthPercent, active7dPercent, dailyNewUsers,
    detectedFields: { createdAtField, lastActiveField, blockedField, botIdField, userIdField },
  };
}

router.post("/file/analytics", upload.single("file"), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Koi file nahi mili" });

    const originalName = req.file.originalname || "file.csv";
    const ext = originalName.split(".").pop() || "csv";
    const content = req.file.buffer.toString("utf-8");

    if (!content.trim()) return res.status(400).json({ error: "File empty hai" });

    const rows = parseRows(content, ext);
    if (!rows.length) return res.status(400).json({ error: "File mein koi data nahi mila" });

    const analytics = buildAnalytics(rows);
    return res.json(analytics);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "File parse nahi hua" });
  }
});

export default router;
