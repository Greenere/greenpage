export const UI_COPY = {
  domains: {
    research: {
      display: 'research',
      cardTag: 'RESEARCH',
    },
    education: {
      display: 'education',
      cardTag: 'EDUCATION',
    },
    travel: {
      display: 'travel',
      cardTag: 'TRAVEL',
    },
    blog: {
      display: 'writing',
      cardTag: 'BLOG',
    },
    experience: {
      display: 'experience',
      cardTag: 'EXPERIENCE',
    },
    project: {
      display: 'project',
      cardTag: 'PROJECT',
    },
  },
  graphRelations: {
    nextInTimeline: 'adjacent in timeline',
    latestNodeInDomain: 'latest node in domain',
  },
  graphHome: {
    loading: 'Loading graph...',
    errorLoading: 'Error loading graph model',
  },
  storyNode: {
    moreDetails: 'more details',
    dragChildNodesHint: 'Drag child nodes inside this domain',
    openDetailPageAriaLabel: (title: string) => `Open detail page for ${title}`,
  },
  bioNode: {
    aboutMe: 'about me',
    reset: 'reset',
    fallbackName: 'Haoyang Li',
    fallbackSubtitle: 'Software engineer in the San Francisco Bay Area',
    fallbackContact: 'lihaoyangjingzhou@outlook.com',
    openBioDetailPageAriaLabel: 'Open the bio detail page',
    resetGraphLayoutAriaLabel: 'Reset graph layout',
  },
  nodeDetailPage: {
    backToGraph: 'Back to graph',
    loading: 'Loading node content...',
    errorLoading: 'Error loading node content',
    notFoundTitle: 'Node not found',
    notFoundDescription: (nodeId: string) => `The node "${nodeId}" does not exist in the current graph dataset.`,
    returnToGraph: 'Return to the graph',
    metaLabels: {
      date: 'Date',
      place: 'Place',
      read: 'Read',
      status: 'Status',
    },
    sections: {
      gallery: 'Gallery',
      story: 'Story',
      connectedNodes: 'Click to Explore Connected nodes',
    },
    bioEntry: {
      title: 'Haoyang Li',
      kind: 'BIO',
      fallbackSubtitle: 'Software engineer in the San Francisco Bay Area',
    },
  },
  bioDetailPage: {
    backToGraph: 'Back to graph',
    loading: 'Loading bio content...',
    errorLoading: 'Error loading bio content',
    fallbackEyebrow: 'Bio node',
    fallbackThemeFactLabel: 'Current frame',
    fallbackPathsSectionLabel: 'Click to Explore Paths into the Graph',
    fallbackLinksSectionLabel: 'Elsewhere',
    portraitAlt: (name: string) => `Portrait of ${name}`,
  },
  contentLoaders: {
    failedToLoadBioContentFrom: (url: string) => `Failed to load bio content from ${url}`,
    invalidBioContentPayloadFrom: (url: string) => `Invalid bio content payload from ${url}`,
    failedToLoadContentFor: (nodeId: string, status: number) => `Failed to load content for "${nodeId}": ${status}`,
    failedToLoadGraphModel: (status: number) => `Failed to load graph model: ${status}`,
  },
} as const;
