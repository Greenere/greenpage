import fs from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'

import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { getChronologySortKey, normalizeChronologyValue, type ChronologyValue } from './src/shared/chronology'

const ROOT_DIR = path.resolve()
const GRAPH_JSON_PATH = path.resolve(ROOT_DIR, 'public/data/graph.json')
const NODES_DIR = path.resolve(ROOT_DIR, 'public/data/nodes')
const DOMAINS_CONFIG_PATH = path.resolve(ROOT_DIR, 'src/configs/domains.ts')

type EditorGraphNode = {
  id: string
  kind: string
  domain: string
  chronology: ChronologyValue
  contentPath?: string
}

type EditorNodeSummary = EditorGraphNode & {
  title?: string
  subtitle?: string
}

type EditorGraphModel = {
  settings?: Record<string, unknown>
  nodes: EditorGraphNode[]
  relations: Array<Record<string, unknown>>
}

type EditorExplicitRelation = {
  from: string
  to: string
  kind: string
  label: string
  strength: 1 | 2 | 3
}

function isSafeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function serializeJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function getNodeContentFileName(nodeId: string) {
  return `${nodeId.replace(/-/g, '_')}.json`
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf8')
  return JSON.parse(content) as T
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, serializeJson(value), 'utf8')
}

async function readGraphModel() {
  const graph = await readJsonFile<EditorGraphModel>(GRAPH_JSON_PATH)
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      chronology: normalizeChronologyValue(node.chronology),
    })),
  }
}

async function readDomainsConfigSource() {
  return fs.readFile(DOMAINS_CONFIG_PATH, 'utf8')
}

async function readDomainIds() {
  const source = await readDomainsConfigSource()
  const bodyMatch = source.match(/export const DOMAIN_CONFIG = \{([\s\S]*?)\} as const;/)
  if (!bodyMatch) {
    throw new Error('Unable to parse DOMAIN_CONFIG.')
  }

  return [...bodyMatch[1].matchAll(/^\s{2}([a-z0-9-]+):\s*\{/gm)].map((match) => match[1])
}

function getNodeContentPath(node: EditorGraphNode) {
  if (node.contentPath) {
    const normalized = node.contentPath.replace(/^\/+/, '')
    return path.resolve(ROOT_DIR, 'public', normalized)
  }

  return path.resolve(NODES_DIR, node.domain, getNodeContentFileName(node.id))
}

async function readNodeSummary(node: EditorGraphNode): Promise<EditorNodeSummary> {
  try {
    const content = await readJsonFile<Record<string, unknown>>(getNodeContentPath(node))
    const title = typeof content.title === 'string' && content.title.trim() ? content.title : node.id
    const subtitle = typeof content.subtitle === 'string' && content.subtitle.trim() ? content.subtitle : undefined
    return { ...node, title, subtitle }
  } catch {
    return { ...node, title: node.id }
  }
}

function sendJson(response: ServerResponse<IncomingMessage>, statusCode: number, payload: unknown) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function parseBody(request: NodeJS.ReadableStream) {
  const chunks: Uint8Array[] = []
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? (JSON.parse(text) as Record<string, unknown>) : {}
}

function sortNodes(nodes: EditorGraphNode[]) {
  return [...nodes].sort((left, right) => {
    if (left.domain !== right.domain) {
      return left.domain.localeCompare(right.domain)
    }

    if (left.chronology !== right.chronology) {
      return getChronologySortKey(left.chronology) - getChronologySortKey(right.chronology)
    }

    return left.id.localeCompare(right.id)
  })
}

function toRelationId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildExplicitRelationId(nodeId: string, relation: EditorExplicitRelation, index: number) {
  return `editor-${nodeId}-${toRelationId(relation.kind)}-${toRelationId(relation.from)}-${toRelationId(relation.to)}-${index + 1}`
}

function isCompleteExplicitRelation(relation: EditorExplicitRelation) {
  return relation.from.trim().length > 0 && relation.to.trim().length > 0
}

function createNodeEditorPlugin(): Plugin {
  return {
    name: 'greenpage-node-editor-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        try {
          const requestUrl = new URL(request.url ?? '/', 'http://localhost')

          if (request.method === 'GET' && requestUrl.pathname === '/__editor/bootstrap') {
            const graph = await readGraphModel()
            const nodes = await Promise.all(graph.nodes.map((node) => readNodeSummary(node)))
            sendJson(response, 200, { nodes })
            return
          }

          if (request.method === 'GET' && requestUrl.pathname === '/__editor/node') {
            const nodeId = requestUrl.searchParams.get('nodeId')?.trim()
            if (!nodeId) {
              sendJson(response, 400, { error: 'Missing nodeId.' })
              return
            }

            const graph = await readGraphModel()
            const node = graph.nodes.find((entry) => entry.id === nodeId)
            if (!node) {
              sendJson(response, 404, { error: `Node "${nodeId}" was not found.` })
              return
            }

            const contentPath = getNodeContentPath(node)
            const content = await readJsonFile<Record<string, unknown>>(contentPath)
            sendJson(response, 200, {
              node,
              content,
              contentPath: path.relative(ROOT_DIR, contentPath),
              explicitRelations: graph.relations.filter((relation) => {
                if (relation.kind === 'sequence') return false
                return relation.from === nodeId || relation.to === nodeId
              }),
            })
            return
          }

          if (request.method === 'POST' && requestUrl.pathname === '/__editor/node/save') {
            const body = await parseBody(request)
            const nodeId = typeof body.nodeId === 'string' ? body.nodeId.trim() : ''

            if (!nodeId) {
              sendJson(response, 400, { error: 'Missing nodeId.' })
              return
            }

            const graph = await readGraphModel()
            const node = graph.nodes.find((entry) => entry.id === nodeId)
            if (!node) {
              sendJson(response, 404, { error: `Node "${nodeId}" was not found.` })
              return
            }

            const nextNodeCandidate = body.node
            if (
              !nextNodeCandidate ||
              typeof nextNodeCandidate !== 'object'
            ) {
              sendJson(response, 400, { error: 'Missing node structure payload.' })
              return
            }

            const nextNode = nextNodeCandidate as Record<string, unknown>
            if (
              typeof nextNode.id !== 'string' ||
              typeof nextNode.domain !== 'string' ||
              typeof nextNode.kind !== 'string'
            ) {
              sendJson(response, 400, { error: 'Missing node structure payload.' })
              return
            }

            let nextChronology: ChronologyValue
            try {
              nextChronology = normalizeChronologyValue(nextNode.chronology)
            } catch (error) {
              sendJson(response, 400, { error: 'Invalid chronology.' })
              return
            }

            const relationPayload = Array.isArray(body.explicitRelations) ? body.explicitRelations : []
            const nextRelations = relationPayload.flatMap((relation, index) => {
              if (
                !relation ||
                typeof relation !== 'object' ||
                typeof relation.from !== 'string' ||
                typeof relation.to !== 'string' ||
                typeof relation.kind !== 'string' ||
                typeof relation.label !== 'string' ||
                (relation.strength !== 1 && relation.strength !== 2 && relation.strength !== 3)
              ) {
                throw new Error(`Invalid relation at index ${index}.`)
              }

              const nextRelation = relation as EditorExplicitRelation
              if (!isCompleteExplicitRelation(nextRelation)) {
                return []
              }

              return [{
                id: buildExplicitRelationId(nodeId, nextRelation, index),
                from: nextRelation.from,
                to: nextRelation.to,
                kind: nextRelation.kind,
                label: nextRelation.label,
                strength: nextRelation.strength,
              }]
            })

            node.kind = nextNode.kind
            node.domain = nextNode.domain
            node.chronology = nextChronology

            await writeJsonFile(getNodeContentPath(node), body.content ?? {})
            graph.nodes = sortNodes(graph.nodes)
            graph.relations = [
              ...graph.relations.filter((relation) => relation.kind === 'sequence' || (relation.from !== nodeId && relation.to !== nodeId)),
              ...nextRelations,
            ]
            await writeJsonFile(GRAPH_JSON_PATH, graph)
            sendJson(response, 200, { ok: true })
            return
          }

          if (request.method === 'POST' && requestUrl.pathname === '/__editor/node/create') {
            const body = await parseBody(request)
            const node = body.node

            if (!node || typeof node !== 'object') {
              sendJson(response, 400, { error: 'Missing node payload.' })
              return
            }

            const nextNode = node as Record<string, unknown>
            const nodeId = typeof nextNode.id === 'string' ? nextNode.id.trim() : ''
            const domain = typeof nextNode.domain === 'string' ? nextNode.domain.trim() : ''
            const kind = typeof nextNode.kind === 'string' ? nextNode.kind.trim() : ''
            let chronology: ChronologyValue
            try {
              chronology = normalizeChronologyValue(nextNode.chronology)
            } catch {
              chronology = ''
            }

            if (!nodeId || !domain || !kind || !chronology) {
              sendJson(response, 400, { error: 'New node is missing required fields.' })
              return
            }

            if (!isSafeSlug(nodeId)) {
              sendJson(response, 400, { error: 'Node id should use lowercase letters, numbers, and hyphens only.' })
              return
            }

            const domainIds = await readDomainIds()
            if (!domainIds.includes(domain)) {
              sendJson(response, 400, { error: `Unknown domain "${domain}". Add the domain first.` })
              return
            }

            const graph = await readGraphModel()
            if (graph.nodes.some((entry) => entry.id === nodeId)) {
              sendJson(response, 409, { error: `Node "${nodeId}" already exists.` })
              return
            }

            const createdNode: EditorGraphNode = {
              id: nodeId,
              domain,
              kind,
              chronology,
            }

            graph.nodes = sortNodes([...graph.nodes, createdNode])
            await writeJsonFile(getNodeContentPath(createdNode), body.content ?? {})
            await writeJsonFile(GRAPH_JSON_PATH, graph)
            sendJson(response, 200, { ok: true, nodeId, node: createdNode })
            return
          }

          if (request.method === 'POST' && requestUrl.pathname === '/__editor/domain/create') {
            const body = await parseBody(request)
            const domainId = typeof body.domainId === 'string' ? body.domainId.trim() : ''
            const display = typeof body.display === 'string' ? body.display.trim() : ''
            const cardTag = typeof body.cardTag === 'string' ? body.cardTag.trim() : ''
            const seedAngle = typeof body.seedAngle === 'number' ? body.seedAngle : Number(body.seedAngle)

            if (!domainId || !display || !cardTag || Number.isNaN(seedAngle)) {
              sendJson(response, 400, { error: 'New domain is missing required fields.' })
              return
            }

            if (!isSafeSlug(domainId)) {
              sendJson(response, 400, { error: 'Domain id should use lowercase letters, numbers, and hyphens only.' })
              return
            }

            const source = await readDomainsConfigSource()
            if (new RegExp(`^\\s{2}${domainId}:\\s*\\{`, 'm').test(source)) {
              sendJson(response, 409, { error: `Domain "${domainId}" already exists.` })
              return
            }

            const existingCardTags = [...source.matchAll(/cardTag:\s*['"`]([^'"`]+)['"`]/g)].map((match) => match[1].toLowerCase())
            if (existingCardTags.includes(cardTag.toLowerCase())) {
              sendJson(response, 409, { error: `Card tag "${cardTag}" already exists.` })
              return
            }

            const insertion = `  ${domainId}: {\n    display: ${JSON.stringify(display)},\n    cardTag: ${JSON.stringify(cardTag)},\n    seedAngle: ${seedAngle},\n  },\n`
            const updatedSource = source.replace(/\} as const;/, `${insertion}} as const;`)

            if (updatedSource === source) {
              sendJson(response, 500, { error: 'Unable to update domains config.' })
              return
            }

            await fs.writeFile(DOMAINS_CONFIG_PATH, updatedSource, 'utf8')
            await fs.mkdir(path.resolve(NODES_DIR, domainId), { recursive: true })
            sendJson(response, 200, { ok: true, domainId })
            return
          }

          if (request.method === 'POST' && requestUrl.pathname === '/__editor/domain/delete') {
            const body = await parseBody(request)
            const domainId = typeof body.domainId === 'string' ? body.domainId.trim() : ''

            if (!domainId) {
              sendJson(response, 400, { error: 'Missing domainId.' })
              return
            }

            const graph = await readGraphModel()
            if (graph.nodes.some((node) => node.domain === domainId)) {
              sendJson(response, 400, { error: `Domain "${domainId}" still has nodes and cannot be deleted.` })
              return
            }

            const source = await readDomainsConfigSource()
            if (!new RegExp(`^\\s{2}${domainId}:\\s*\\{`, 'm').test(source)) {
              sendJson(response, 404, { error: `Domain "${domainId}" does not exist.` })
              return
            }

            const updatedSource = source.replace(
              new RegExp(`^\\s{2}${domainId}:\\s*\\{\\n(?:\\s{4}.*\\n)*?\\s{2}\\},\\n`, 'm'),
              ''
            )

            if (updatedSource === source) {
              sendJson(response, 500, { error: 'Unable to update domains config.' })
              return
            }

            await fs.writeFile(DOMAINS_CONFIG_PATH, updatedSource, 'utf8')
            await fs.rm(path.resolve(NODES_DIR, domainId), { recursive: true, force: true })
            sendJson(response, 200, { ok: true, domainId })
            return
          }

          next()
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Editor API failed.'
          sendJson(response, 500, { error: message })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), createNodeEditorPlugin()],
  base: "/greenpage/",
})
