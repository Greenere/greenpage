import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const graphPath = path.join(publicDir, 'data', 'graph.json');
const nodesDir = path.join(publicDir, 'data', 'nodes');
const indexPath = path.join(nodesDir, 'index.json');

function getNodeContentFileName(nodeId) {
  return `${nodeId.replace(/-/g, '_')}.json`;
}

function resolveContentPath(nodeRef) {
  if (typeof nodeRef.contentPath === 'string' && nodeRef.contentPath.length > 0) {
    return path.join(publicDir, nodeRef.contentPath.replace(/^\//, ''));
  }

  if (typeof nodeRef.domain !== 'string' || nodeRef.domain.length === 0) {
    throw new Error(`Graph node ref "${String(nodeRef.id)}" must include a "domain" to resolve its content path.`);
  }

  return path.join(nodesDir, nodeRef.domain, getNodeContentFileName(nodeRef.id));
}

async function main() {
  const graphRaw = await fs.readFile(graphPath, 'utf8');
  const graph = JSON.parse(graphRaw);
  const nodeRefs = Array.isArray(graph.nodes) ? graph.nodes : [];
  const index = {};

  for (const nodeRef of nodeRefs) {
    if (!nodeRef || typeof nodeRef !== 'object' || typeof nodeRef.id !== 'string') {
      throw new Error('Graph node refs must include an "id" field.');
    }

    const contentPath = resolveContentPath(nodeRef);
    const contentRaw = await fs.readFile(contentPath, 'utf8');
    index[nodeRef.id] = JSON.parse(contentRaw);
  }

  await fs.mkdir(nodesDir, { recursive: true });
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);

  console.log(`Generated ${path.relative(rootDir, indexPath)} with ${Object.keys(index).length} node entries.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
