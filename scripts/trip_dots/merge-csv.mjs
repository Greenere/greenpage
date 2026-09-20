import { createReadStream } from 'node:fs';
import { access, rename, writeFile } from 'node:fs/promises';
import readline from 'node:readline';

async function readRows(csvPath) {
  const exists = await access(csvPath)
    .then(() => true)
    .catch(() => false);
  if (!exists) return { header: null, rows: new Map() };

  const rl = readline.createInterface({ input: createReadStream(csvPath), crlfDelay: Infinity });
  let header = null;
  const rows = new Map();
  for await (const line of rl) {
    if (header === null) {
      header = line;
      continue;
    }
    if (!line) continue;
    const ts = line.slice(0, line.indexOf(','));
    rows.set(ts, line);
  }
  return { header, rows };
}

// Merges a newly exported raw-ping CSV into the canonical MAIN_CSV_PATH source
// in place, deduped by the dataTime (ts) column — same schema/dedup key
// parse-csv.mjs's own Stage A cleanup assumes. The new file's row wins on a
// timestamp collision (it's the more recently exported copy of that data).
// Row order in either input doesn't matter — loadCleanedPoints sorts by ts
// itself, so this only needs to produce a valid, deduped union.
export async function mergeCsvInto(mainCsvPath, newCsvPath) {
  const [existing, incoming] = await Promise.all([readRows(mainCsvPath), readRows(newCsvPath)]);
  if (incoming.header === null) throw new Error(`${newCsvPath} is empty or unreadable.`);

  const header = existing.header ?? incoming.header;
  const beforeCount = existing.rows.size;
  let addedCount = 0;
  for (const [ts, line] of incoming.rows) {
    if (!existing.rows.has(ts)) addedCount++;
    existing.rows.set(ts, line);
  }

  const sortedTs = [...existing.rows.keys()].sort((a, b) => Number(a) - Number(b));
  const tmpPath = `${mainCsvPath}.tmp-${process.pid}`;
  const lines = [header];
  for (const ts of sortedTs) lines.push(existing.rows.get(ts));
  await writeFile(tmpPath, `${lines.join('\n')}\n`, 'utf8');
  await rename(tmpPath, mainCsvPath);

  return { beforeCount, afterCount: existing.rows.size, addedCount };
}
