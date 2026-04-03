import { generateNodeContentIndexes } from './node_content_indexes.mjs';

async function main() {
  await generateNodeContentIndexes({ rootDir: process.cwd() });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
