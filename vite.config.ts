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

const SUPPORTED_LANGUAGES = ['en', 'zh-CN'] as const

// Maps app locale id (e.g. 'zh-CN') to file suffix (e.g. 'zh_cn').
// Unrecognised locales fall back to 'en'.
function localeToFileSuffix(lang: string): string {
  if (lang === 'zh-CN') return 'zh_cn'
  return 'en'
}

function getLocaleFallbackLanguages(lang: string): string[] {
  const normalized = lang === 'zh-CN' ? 'zh-CN' : 'en'
  const ordered = [normalized]

  if (normalized !== 'en') {
    ordered.push('en')
  }

  for (const locale of SUPPORTED_LANGUAGES) {
    if (!ordered.includes(locale)) {
      ordered.push(locale)
    }
  }

  return ordered
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

function isNotFoundError(error: unknown) {
  return error !== null && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT'
}

async function readJsonFileIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return await readJsonFile<T>(filePath)
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }
    throw error
  }
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

// Returns the absolute path to a node's content file, locale-specific.
function getLocaleNodeContentPath(node: EditorGraphNode, suffix: string): string {
  if (node.contentPath) {
    const normalized = node.contentPath.replace(/^\/+/, '')
    return path.resolve(ROOT_DIR, 'public', normalized)
  }
  const baseName = node.id.replace(/-/g, '_')
  return path.resolve(NODES_DIR, node.domain, `${baseName}.${suffix}.json`)
}

// Returns the pre-migration legacy path (no locale suffix).
function getLegacyNodeContentPath(node: EditorGraphNode): string {
  if (node.contentPath) {
    const normalized = node.contentPath.replace(/^\/+/, '')
    return path.resolve(ROOT_DIR, 'public', normalized)
  }
  return path.resolve(NODES_DIR, node.domain, getNodeContentFileName(node.id))
}

// Tries locale path → English path → legacy path, returns content and whether a fallback was used.
async function readNodeContentWithFallback(
  node: EditorGraphNode,
  lang: string,
): Promise<{ content: Record<string, unknown>; isFallbackContent: boolean; resolvedLanguage: string; resolvedPath: string }> {
  for (const fallbackLanguage of getLocaleFallbackLanguages(lang)) {
    const filePath = getLocaleNodeContentPath(node, localeToFileSuffix(fallbackLanguage))
    const content = await readJsonFileIfExists<Record<string, unknown>>(filePath)

    if (content) {
      return {
        content,
        isFallbackContent: fallbackLanguage !== lang,
        resolvedLanguage: fallbackLanguage,
        resolvedPath: filePath,
      }
    }
  }

  const legacyPath = getLegacyNodeContentPath(node)
  const legacyContent = await readJsonFileIfExists<Record<string, unknown>>(legacyPath)
  if (legacyContent) {
    return {
      content: legacyContent,
      isFallbackContent: lang !== 'en',
      resolvedLanguage: 'en',
      resolvedPath: legacyPath,
    }
  }

  throw new Error(`No content file found for node "${node.id}".`)
}

async function readNodeSummary(node: EditorGraphNode, lang: string): Promise<EditorNodeSummary> {
  try {
    const { content } = await readNodeContentWithFallback(node, lang)
    const title = typeof content.title === 'string' && content.title.trim() ? content.title : node.id
    const subtitle = typeof content.subtitle === 'string' && content.subtitle.trim() ? content.subtitle : undefined
    return { ...node, title, subtitle }
  } catch {
    return { ...node, title: node.id }
  }
}

// Resolves a relation label for the given lang from the `labels` map or legacy `label` field.
function resolveRelationLabel(relation: Record<string, unknown>, lang: string): string {
  const labels = relation.labels
  if (labels && typeof labels === 'object' && !Array.isArray(labels)) {
    const labelsObj = labels as Record<string, unknown>
    for (const fallbackLanguage of getLocaleFallbackLanguages(lang)) {
      if (typeof labelsObj[fallbackLanguage] === 'string') return labelsObj[fallbackLanguage] as string
    }
  }
  return typeof relation.label === 'string' ? relation.label : ''
}

// Returns the existing locale labels for a relation, normalising legacy `label` as English.
function getExistingRelationLabels(existing: Record<string, unknown> | undefined): Record<string, string> {
  if (!existing) return {}
  if (existing.labels && typeof existing.labels === 'object' && !Array.isArray(existing.labels)) {
    return existing.labels as Record<string, string>
  }
  if (typeof existing.label === 'string') {
    return { en: existing.label }
  }
  return {}
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

function getExplicitRelationSignature(relation: EditorExplicitRelation) {
  const from = relation.from.trim()
  const to = relation.to.trim()
  if (!from || !to) {
    return null
  }

  const [leftNodeId, rightNodeId] = [from, to].sort((left, right) => left.localeCompare(right))
  return `${leftNodeId}::${rightNodeId}`
}

function getExplicitRelationPeerId(relation: EditorExplicitRelation, currentNodeId: string) {
  if (relation.from === currentNodeId) {
    return relation.to
  }

  if (relation.to === currentNodeId) {
    return relation.from
  }

  return relation.to || relation.from
}

function getTimelineConnectionPeerIds(currentNode: EditorGraphNode, nodes: EditorGraphNode[]) {
  const domainNodes = nodes
    .map((node) => (node.id === currentNode.id ? { ...node, chronology: currentNode.chronology } : node))
    .filter((node) => node.domain === currentNode.domain)
    .sort(compareEditorNodes)
  const currentIndex = domainNodes.findIndex((node) => node.id === currentNode.id)

  if (currentIndex === -1) {
    return [] as string[]
  }

  return [domainNodes[currentIndex - 1], domainNodes[currentIndex + 1]]
    .filter((node): node is EditorGraphNode => Boolean(node))
    .map((node) => node.id)
}

function getBioConnectionPeerId(currentNode: EditorGraphNode, nodes: EditorGraphNode[]) {
  if (currentNode.id === 'bio') {
    return null
  }

  const domainNodes = nodes
    .map((node) => (node.id === currentNode.id ? { ...node, chronology: currentNode.chronology } : node))
    .filter((node) => node.domain === currentNode.domain)
    .sort(compareEditorNodes)
  const latestNode = domainNodes[domainNodes.length - 1]

  if (!latestNode || latestNode.id !== currentNode.id) {
    return null
  }

  return 'bio'
}

function getImplicitConnectionPeerIds(currentNode: EditorGraphNode, nodes: EditorGraphNode[]) {
  const peerIds = new Set<string>()

  getTimelineConnectionPeerIds(currentNode, nodes).forEach((nodeId) => {
    peerIds.add(nodeId)
  })

  const bioPeerId = getBioConnectionPeerId(currentNode, nodes)
  if (bioPeerId) {
    peerIds.add(bioPeerId)
  }

  return peerIds
}

function compareEditorNodes(left: EditorGraphNode, right: EditorGraphNode) {
  if (left.domain !== right.domain) {
    return left.domain.localeCompare(right.domain)
  }

  if (left.chronology !== right.chronology) {
    return getChronologySortKey(left.chronology) - getChronologySortKey(right.chronology)
  }

  return left.id.localeCompare(right.id)
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
            const lang = requestUrl.searchParams.get('lang') ?? 'en'
            const graph = await readGraphModel()
            const nodes = await Promise.all(graph.nodes.map((node) => readNodeSummary(node, lang)))
            sendJson(response, 200, { nodes })
            return
          }

          if (request.method === 'GET' && requestUrl.pathname === '/__editor/node') {
            const nodeId = requestUrl.searchParams.get('nodeId')?.trim()
            const lang = requestUrl.searchParams.get('lang') ?? 'en'

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

            const { content, isFallbackContent, resolvedLanguage, resolvedPath } = await readNodeContentWithFallback(node, lang)

            sendJson(response, 200, {
              node,
              content,
              contentPath: path.relative(ROOT_DIR, resolvedPath),
              isFallbackContent,
              resolvedLanguage,
              explicitRelations: graph.relations
                .filter((relation) => {
                  if (relation.kind === 'sequence') return false
                  return relation.from === nodeId || relation.to === nodeId
                })
                .map((relation) => ({
                  ...relation,
                  label: resolveRelationLabel(relation, lang),
                })),
            })
            return
          }

          if (request.method === 'POST' && requestUrl.pathname === '/__editor/node/save') {
            const body = await parseBody(request)
            const nodeId = typeof body.nodeId === 'string' ? body.nodeId.trim() : ''
            const lang = typeof body.lang === 'string' ? body.lang : 'en'
            const suffix = localeToFileSuffix(lang)

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
            const nextNodeForValidation: EditorGraphNode = {
              ...node,
              id: nextNode.id,
              domain: nextNode.domain,
              kind: nextNode.kind,
              chronology: nextChronology,
            }
            const nextNodesForValidation = graph.nodes.map((entry) =>
              entry.id === nodeId ? nextNodeForValidation : entry
            )
            const implicitPeerIds = getImplicitConnectionPeerIds(nextNodeForValidation, nextNodesForValidation)
            const seenRelationSignatures = new Set<string>()
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

              const relationSignature = getExplicitRelationSignature(nextRelation)
              if (!relationSignature) {
                return []
              }
              if (seenRelationSignatures.has(relationSignature)) {
                throw new Error('Duplicate explicit connections are not allowed.')
              }

              const peerId = getExplicitRelationPeerId(nextRelation, nodeId).trim()
              if (peerId && implicitPeerIds.has(peerId)) {
                throw new Error('This connection already exists.')
              }

              seenRelationSignatures.add(relationSignature)

              const relationId = buildExplicitRelationId(nodeId, nextRelation, index)
              const existingRelation = graph.relations.find((r) => r.id === relationId)
              const existingLabels = getExistingRelationLabels(existingRelation)
              const mergedLabels = { ...existingLabels, [lang]: nextRelation.label }

              return [{
                id: relationId,
                from: nextRelation.from,
                to: nextRelation.to,
                kind: nextRelation.kind,
                labels: mergedLabels,
                strength: nextRelation.strength,
              }]
            })

            node.kind = nextNode.kind
            node.domain = nextNode.domain
            node.chronology = nextChronology

            // Write only the current locale's content file.
            await writeJsonFile(getLocaleNodeContentPath(node, suffix), body.content ?? {})
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
            // New nodes are always created as English files first.
            await writeJsonFile(getLocaleNodeContentPath(createdNode, 'en'), body.content ?? {})
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
