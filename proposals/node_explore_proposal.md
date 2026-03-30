# Node Explore Proposal

## Goal

Design a content model for a graph-based personal website that can support:

- work experience
- travel experience
- research
- projects
- writings
- photos

without forcing every content type into one overly rigid schema.

The intended interaction is:

- the user centers on a node
- the UI hints at adjacent nodes worth exploring
- connections can express reasons like time, location, type, target, or motivation

## Core proposal

The recommended approach is a hybrid model with three parts:

1. `nodes`
2. `relations`
3. `focus presets`

Instead of building one perfect universal node type for every possible content shape, use:

- a small shared node shell
- a flexible content payload
- a separate relation model that explains why things are connected

This keeps the model structured without making travel, work, research, and writing look artificially identical.

## Why the previous approach felt hard

The main challenge is that these domains are not symmetrical.

A work entry wants fields like:

- company
- role
- impact
- tools

A travel entry wants:

- place
- date
- photos
- why it mattered

A writing entry wants:

- platform
- topic
- audience
- link

Trying to make one rigid schema fit all of them usually leads to either:

- too many optional fields
- too many special cases
- a model that is hard to read and maintain

## Recommended model

### 1. Node shell

Every content item should share a small, stable outer structure.

Example fields:

- `id`
- `kind`
- `title`
- `subtitle`
- `summary`
- `preview`
- `tags`
- `time`
- `place`
- `facets`
- `detail`

Suggested type:

```ts
type NodeKind =
  | 'person'
  | 'work'
  | 'research'
  | 'project'
  | 'writing'
  | 'travel'
  | 'photo'
  | 'education'
  | 'topic'
  | 'place'
  | 'time-marker';

type GraphNode = {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle?: string;
  summary?: string;
  preview?: {
    image?: string;
    icon?: string;
    accent?: string;
  };
  tags?: string[];
  time?: {
    start?: string;
    end?: string;
    label?: string;
  };
  place?: {
    id?: string;
    label?: string;
  };
  facets?: Record<string, string | string[] | number | boolean>;
  detail?: ContentBlock[];
};
```

### 2. Flexible content blocks

The detail body should use flexible blocks instead of one custom schema per node category.

Suggested type:

```ts
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'image'; src: string; caption?: string }
  | { type: 'link'; label: string; href: string }
  | { type: 'list'; items: string[] };
```

This makes it easier to describe different node types with the same rendering system.

### 3. Relation model

Connections should be first-class data, not just visual edges.

Each relation should explain why two nodes are connected.

Suggested type:

```ts
type RelationKind =
  | 'time'
  | 'location'
  | 'type'
  | 'target'
  | 'reason'
  | 'tool'
  | 'topic'
  | 'outcome'
  | 'influenced-by'
  | 'belongs-to';

type Relation = {
  id: string;
  from: string;
  to: string;
  kind: RelationKind;
  label?: string;
  strength?: 1 | 2 | 3;
  directional?: boolean;
  hiddenUntilFocus?: boolean;
  metadata?: Record<string, string>;
};
```

This allows the graph to say not only that two things are related, but how.

### 4. Focus presets

When a node is centered, the UI should not show every possible adjacent connection.

Instead, focus behavior should be guided by lightweight presets.

Suggested type:

```ts
type FocusPreset = {
  nodeId: string;
  primaryRelations?: RelationKind[];
  maxVisibleNeighbors?: number;
  pinNeighbors?: string[];
};
```

This keeps exploration intentional and less overwhelming.

## Key principle

Store many relations, show few relations.

The data model can be rich, but the screen should stay calm.

Recommended rendering strategy:

- global view:
  - show only major anchor nodes
- focused node view:
  - show strongest nearby neighbors
  - try to show variety across relation types
- detail mode:
  - let the user expand groups like "connected by time" or "connected by location"

This matches the original idea of guiding exploration instead of dumping the whole graph at once.

## Connection categories

The following relation kinds fit the original concept well:

- `time`
  Things that happened in the same period.
- `location`
  Things tied to the same place.
- `type`
  Things in the same category.
- `target`
  Things aimed at the same user, audience, or problem.
- `reason`
  Things connected by personal motivation or narrative meaning.
- `tool`
  Things using the same technology or medium.
- `topic`
  Things about the same subject.
- `outcome`
  Things that produced or led to each other.

These categories let edges feel meaningful instead of arbitrary.

## Practical content structure

A manageable way to structure the graph is to think in three layers:

### 1. Anchor nodes

These are high-level homepage entry points.

Examples:

- Bio
- Work
- Research
- Writing
- Travel
- Projects
- Photos

### 2. Entry nodes

These are specific items inside each domain.

Examples:

- a specific job
- a specific trip
- a specific paper
- a specific blog post
- a specific project

### 3. Facet nodes

These are optional supporting nodes used for navigation and grouping.

Examples:

- places
- years
- topics
- tools

Facet nodes should not necessarily be visible all the time. They can appear only when useful.

## Recommended product direction

For this project, the most practical direction is:

- keep the homepage graph mostly composed of anchor nodes
- when an anchor is focused, reveal entry nodes
- keep `time`, `place`, `topic`, `tool`, and `reason` primarily as relation metadata
- only introduce visible facet nodes when they clearly improve exploration

This keeps the initial experience elegant while preserving room for deeper graph structure later.

## Anchor zone proposal

One promising extension of the anchor-node model is to let each top-level node become a container when focused.

In this model:

- top-level nodes act as anchor zones in the homepage view
- when an anchor is focused, it expands into a box or region
- that region "collects" the nodes primarily associated with that anchor

Examples:

- focusing `Education` could expand a container that holds schools, programs, and education-centered entries
- focusing `Research` could expand a container that holds papers, projects, topics, and related outputs
- focusing `Travel` could expand a container that holds places, trips, and photo sets

This solves part of the future layout problem by giving nodes a home region instead of treating the whole graph as one open floating field.

### Primary anchor vs cross-domain connection

The key to making this work is to separate containment from meaning.

Each node should have:

- one `primaryAnchor`
- optional cross-domain relations to other anchors or nodes

This means:

- a node belongs to one main anchor for layout and navigation
- the same node can still connect across domains through relations like `time`, `location`, `topic`, `reason`, or `outcome`

Example:

- a research project may have `primaryAnchor: "research"`
- it may still connect to education because it happened during a degree
- it may connect to writing if it later became a post
- it may connect to projects if it produced a demo or implementation

This avoids duplicating nodes across containers while still preserving cross-domain truth.

### Recommended rule

Use:

- containment for navigation
- relations for meaning

Containment answers:

- where should this node appear by default?
- which anchor should collect it when focused?

Relations answer:

- what else is this connected to?
- why does it matter outside its home domain?

### Suggested visual treatment

Inside a focused anchor container, distinguish node roles visually:

- primary child:
  normal node inside the container
- cross-domain related node:
  lighter or satellite-style node, visually linked from outside its home domain
- facet/helper node:
  smaller, lower-emphasis supporting node
- hidden secondary relations:
  hinted through counts, pills, or expandable groups until requested

This keeps focused views readable while still suggesting wider exploration.

### Conceptual framing

It helps to think of anchors as home neighborhoods rather than strict taxonomic boxes.

A node has:

- one home neighborhood
- many possible friendships across neighborhoods

That framing is often a better fit for a personal-history graph than rigid categorization.

## Dragging interaction policy

Dragging should be allowed, but not as a fully free permanent layout system.

The recommended principle is:

- drag for inspection, not for authorship

This means dragging is useful when:

- the user wants to peek around crowded nodes
- the user wants to temporarily separate nearby items
- the user wants a more tactile exploration experience

But dragging should not redefine the structural layout of the graph.

### Recommended behavior by node level

#### Top-level anchor nodes

Recommendation:

- allow no drag, or only very limited drag

Reason:

- the homepage should retain a stable mental map
- major anchors should not drift into arbitrary positions

#### Child/detail nodes inside an anchor

Recommendation:

- allow soft dragging

Reason:

- this preserves playfulness
- users can temporarily rearrange a local cluster
- the node should ease back toward its assigned region after release

#### Cross-domain related nodes

Recommendation:

- allow temporary drag only

Reason:

- they should remain readable as linked visitors, not become detached permanent residents

### Recommended interaction model

A practical interaction policy is:

- click or focus changes the layout
- drag temporarily separates or repositions visible nodes
- release triggers a spring or easing motion back toward layout targets
- optional pinning can be added later for advanced interaction

This preserves the tactile quality of the graph without sacrificing clarity.

### Why this is preferable

If dragging is fully free:

- the graph can lose its shape
- relation-based layout becomes harder to read
- cross-domain structure gets muddled

If dragging is fully disabled:

- the graph can feel stiff
- exploration becomes less playful

So the recommended middle ground is:

- interactive
- tactile
- structurally guided

## Benefits of this approach

- avoids over-designing a single universal schema
- supports very different content types with one rendering system
- makes relations explainable
- keeps the graph visually manageable
- supports guided exploration when a node is centered
- allows future growth without rewriting the model

## Suggested implementation steps

1. Define `GraphNode`, `Relation`, `FocusPreset`, and `ContentBlock` in the content layer.
2. Seed a small dataset using the current homepage concepts:
   - bio
   - research
   - education
   - travel
   - blogs
   - experience
3. Add helper functions such as:
   - `getNodeById`
   - `getRelationsForNode`
   - `getVisibleNeighbors`
   - `rankNeighbors`
4. Refactor the current graph page so node rendering comes from data instead of hard-coded arrays.
5. Add richer entry nodes later for jobs, trips, papers, posts, and projects.

## Summary

The proposal is not to create one perfect universal node type. The proposal is to create:

- a stable shared node shell
- a flexible detail payload
- an explicit relation system
- a focus strategy that controls what gets revealed

That combination is a better fit for a personal knowledge graph or portfolio graph, especially when the content spans work, research, travel, writing, and photography.
