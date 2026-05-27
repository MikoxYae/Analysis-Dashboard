import { Router } from "express";
import { MongoClient, Collection } from "mongodb";

const router = Router();

async function getClient(uri: string) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 6000 });
  await client.connect();
  return client;
}

function startOfDay() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return d;
}

async function fetchCollectionStats(
  col: Collection,
  fields: { createdAtField: string; lastActiveField: string; blockedField: string; botIdField: string; userIdField: string }
) {
  const { createdAtField, lastActiveField, blockedField, botIdField, userIdField } = fields;
  const todayStart = startOfDay();
  const sevenDaysAgo = daysAgo(7);
  const yesterdayStart = daysAgo(1);

  const [unique, todayNew, active7d, todayActive, blocked, yesterdayNew] = await Promise.all([
    col.countDocuments(),
    col.countDocuments({ [createdAtField]: { $gte: todayStart } }),
    col.countDocuments({ [lastActiveField]: { $gte: sevenDaysAgo } }),
    col.countDocuments({ [lastActiveField]: { $gte: todayStart } }),
    col.countDocuments({ [blockedField]: true }),
    col.countDocuments({ [createdAtField]: { $gte: yesterdayStart, $lt: todayStart } }),
  ]);

  const commonResult = await col
    .aggregate([
      { $group: { _id: `$${userIdField}`, cnt: { $sum: 1 } } },
      { $match: { cnt: { $gt: 1 } } },
      { $count: "total" },
    ])
    .toArray();
  const common = commonResult[0]?.total ?? 0;

  const postsResult = await col
    .aggregate([{ $group: { _id: null, bots: { $addToSet: `$${botIdField}` } } }])
    .toArray();
  const posts = postsResult[0]?.bots?.length ?? 0;

  const daily: number[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = daysAgo(i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const count = await col.countDocuments({ [createdAtField]: { $gte: dayStart, $lt: dayEnd } });
    daily.push(count);
  }

  return { unique, todayNew, active7d, todayActive, blocked, yesterdayNew, common, posts, daily };
}

router.post("/mongo/list-databases", async (req, res) => {
  const { uri } = req.body as { uri: string };
  if (!uri) return res.status(400).json({ error: "uri required" });
  let client: MongoClient | null = null;
  try {
    client = await getClient(uri);
    const { databases } = await client.db().admin().listDatabases();
    const items = databases
      .map((d: any) => d.name as string)
      .filter((n: string) => !["admin", "local", "config"].includes(n));
    return res.json({ items });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to list databases" });
  } finally {
    await client?.close();
  }
});

router.post("/mongo/list-collections", async (req, res) => {
  const { uri, database } = req.body as { uri: string; database: string };
  if (!uri || !database) return res.status(400).json({ error: "uri and database required" });
  let client: MongoClient | null = null;
  try {
    client = await getClient(uri);
    const cols = await client.db(database).listCollections().toArray();
    const items = cols.map((c: any) => c.name as string);
    return res.json({ items });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to list collections" });
  } finally {
    await client?.close();
  }
});

router.post("/mongo/analytics", async (req, res) => {
  const {
    uri, database, collection,
    createdAtField = "createdAt",
    lastActiveField = "lastActive",
    blockedField = "isBlocked",
    botIdField = "botId",
    userIdField = "userId",
  } = req.body as {
    uri: string; database: string; collection: string;
    createdAtField?: string; lastActiveField?: string;
    blockedField?: string; botIdField?: string; userIdField?: string;
  };

  if (!uri || !database || !collection)
    return res.status(400).json({ error: "uri, database, and collection are required" });

  let client: MongoClient | null = null;
  try {
    client = await getClient(uri);
    const fields = { createdAtField, lastActiveField, blockedField, botIdField, userIdField };

    let collections: string[];
    if (collection === "__ALL__") {
      const cols = await client.db(database).listCollections().toArray();
      collections = cols.map((c: any) => c.name as string);
    } else {
      collections = [collection];
    }

    // Aggregate across all selected collections
    let unique = 0, todayNew = 0, active7d = 0, todayActive = 0,
      blocked = 0, yesterdayNew = 0, common = 0, posts = 0;
    const dailyTotals = new Array(14).fill(0);

    for (const colName of collections) {
      const col = client.db(database).collection(colName);
      const s = await fetchCollectionStats(col, fields);
      unique += s.unique;
      todayNew += s.todayNew;
      active7d += s.active7d;
      todayActive += s.todayActive;
      blocked += s.blocked;
      yesterdayNew += s.yesterdayNew;
      common += s.common;
      posts += s.posts;
      s.daily.forEach((v, i) => { dailyTotals[i] += v; });
    }

    const growthPercent = yesterdayNew > 0
      ? Math.round(((todayNew - yesterdayNew) / yesterdayNew) * 100)
      : null;
    const active7dPercent = unique > 0 ? Math.round((active7d / unique) * 100) : 0;

    const dailyNewUsers = dailyTotals.map((users, i) => {
      const d = daysAgo(13 - i);
      return { day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), users };
    });

    return res.json({
      todayNew, unique, active7d, todayActive, common, blocked,
      posts, batches: 0, convLinks: 0,
      growthPercent, active7dPercent, dailyNewUsers,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Analytics failed" });
  } finally {
    await client?.close();
  }
});

export default router;
