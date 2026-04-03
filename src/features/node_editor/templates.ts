import { getLocaleMessages } from '../../i18n';
import type { DomainId } from '../../configs/domains';
import type { GraphNodeContent, NodeKind } from '../graph_home/content/Nodes';
import type { NewNodeDraft } from './editorApi';

export const NODE_TEMPLATE_IDS = ['blank', 'research', 'experience', 'travel', 'writing', 'project'] as const;

export type NodeTemplateId = (typeof NODE_TEMPLATE_IDS)[number];

export function getNodeTemplateOptions() {
  const { optionLabels } = getLocaleMessages().nodeTemplates;

  return NODE_TEMPLATE_IDS.map((id) => ({
    id,
    label: optionLabels[id],
  }));
}

type TemplateArgs = {
  title: string;
  subtitle?: string;
  summary: string;
  domain: DomainId;
};

function createBlankTemplate({ title, subtitle, summary }: TemplateArgs): GraphNodeContent {
  const { blank } = getLocaleMessages().nodeTemplates;

  return {
    title,
    subtitle: subtitle || undefined,
    summary,
    sections: [
      {
        id: 'overview',
        label: blank.overviewLabel,
        blocks: [
          {
            type: 'text',
            text: summary || blank.startWriting,
          },
        ],
      },
    ],
  };
}

function createResearchTemplate(args: TemplateArgs): GraphNodeContent {
  const { research } = getLocaleMessages().nodeTemplates;

  return {
    ...createBlankTemplate(args),
    meta: {
      status: 'draft',
    },
    sections: [
      {
        id: 'overview',
        label: research.overviewLabel,
        blocks: [
          {
            type: 'text',
            text: args.summary || research.overviewText,
          },
        ],
      },
      {
        id: 'approach',
        label: research.approachLabel,
        blocks: [
          {
            type: 'text',
            text: research.approachText,
          },
        ],
      },
      {
        id: 'results',
        label: research.resultsLabel,
        blocks: [
          {
            type: 'callout',
            tone: 'highlight',
            title: research.keyTakeawayTitle,
            text: research.keyTakeawayText,
          },
        ],
      },
    ],
  };
}

function createExperienceTemplate(args: TemplateArgs): GraphNodeContent {
  const { experience } = getLocaleMessages().nodeTemplates;

  return {
    ...createBlankTemplate(args),
    sections: [
      {
        id: 'overview',
        label: experience.overviewLabel,
        blocks: [
          {
            type: 'text',
            text: args.summary || experience.overviewText,
          },
        ],
      },
      {
        id: 'work',
        label: experience.workLabel,
        blocks: [
          {
            type: 'list',
            items: [...experience.workItems],
          },
        ],
      },
      {
        id: 'reflection',
        label: experience.reflectionLabel,
        blocks: [
          {
            type: 'quote',
            text: experience.reflectionText,
          },
        ],
      },
    ],
  };
}

function createTravelTemplate(args: TemplateArgs): GraphNodeContent {
  const { travel } = getLocaleMessages().nodeTemplates;

  return {
    ...createBlankTemplate(args),
    sections: [
      {
        id: 'overview',
        label: travel.overviewLabel,
        blocks: [
          {
            type: 'text',
            text: args.summary || travel.overviewText,
          },
        ],
      },
      {
        id: 'photographs',
        label: travel.photographsLabel,
        blocks: [
          {
            type: 'gallery',
            align: 'height',
            columns: 2,
            items: [
              {
                src: 'assets/example.jpg',
                alt: travel.defaultImageAlt,
              },
            ],
          },
        ],
      },
    ],
  };
}

function createWritingTemplate(args: TemplateArgs): GraphNodeContent {
  const { writing } = getLocaleMessages().nodeTemplates;

  return {
    ...createBlankTemplate(args),
    sections: [
      {
        id: 'overview',
        label: writing.overviewLabel,
        blocks: [
          {
            type: 'text',
            text: args.summary || writing.overviewText,
          },
        ],
      },
      {
        id: 'links',
        label: writing.linksLabel,
        blocks: [
          {
            type: 'link',
            label: writing.publishedVersionLabel,
            href: 'https://example.com',
          },
        ],
      },
    ],
  };
}

function createProjectTemplate(args: TemplateArgs): GraphNodeContent {
  const { project } = getLocaleMessages().nodeTemplates;

  return {
    ...createBlankTemplate(args),
    sections: [
      {
        id: 'overview',
        label: project.overviewLabel,
        blocks: [
          {
            type: 'text',
            text: args.summary || project.overviewText,
          },
        ],
      },
      {
        id: 'build',
        label: project.buildLabel,
        blocks: [
          {
            type: 'list',
            items: [...project.buildItems],
          },
        ],
      },
    ],
  };
}

export function getDefaultKindForDomain(domain: DomainId): NodeKind {
  return domain === 'blog' ? 'writing' : domain;
}

export function createTemplateContent(draft: Pick<NewNodeDraft, 'title' | 'subtitle' | 'summary' | 'domain' | 'template'>): GraphNodeContent {
  const { defaults } = getLocaleMessages().nodeTemplates;
  const args: TemplateArgs = {
    title: draft.title || defaults.untitledNodeTitle,
    subtitle: draft.subtitle || undefined,
    summary: draft.summary || defaults.summary,
    domain: draft.domain,
  };

  switch (draft.template as NodeTemplateId) {
    case 'research':
      return createResearchTemplate(args);
    case 'experience':
      return createExperienceTemplate(args);
    case 'travel':
      return createTravelTemplate(args);
    case 'writing':
      return createWritingTemplate(args);
    case 'project':
      return createProjectTemplate(args);
    case 'blank':
    default:
      return createBlankTemplate(args);
  }
}
