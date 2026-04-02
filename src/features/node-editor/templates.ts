import type { DomainId } from '../../configs/domains';
import type { GraphNodeContent, NodeKind } from '../graph-home/content/Nodes';
import type { NewNodeDraft } from './editorApi';

export const NODE_TEMPLATE_OPTIONS = [
  { id: 'blank', label: 'Blank article' },
  { id: 'research', label: 'Research note' },
  { id: 'experience', label: 'Experience entry' },
  { id: 'travel', label: 'Travel story' },
  { id: 'writing', label: 'Writing entry' },
  { id: 'project', label: 'Project page' },
] as const;

export type NodeTemplateId = (typeof NODE_TEMPLATE_OPTIONS)[number]['id'];

type TemplateArgs = {
  title: string;
  subtitle?: string;
  summary: string;
  domain: DomainId;
};

function createBlankTemplate({ title, subtitle, summary }: TemplateArgs): GraphNodeContent {
  return {
    title,
    subtitle: subtitle || undefined,
    summary,
    sections: [
      {
        id: 'overview',
        label: 'Overview',
        blocks: [
          {
            type: 'text',
            text: summary || 'Start writing here.',
          },
        ],
      },
    ],
  };
}

function createResearchTemplate(args: TemplateArgs): GraphNodeContent {
  return {
    ...createBlankTemplate(args),
    meta: {
      status: 'draft',
    },
    sections: [
      {
        id: 'overview',
        label: 'Overview',
        blocks: [
          {
            type: 'text',
            text: args.summary || 'What is this research about, and why does it matter?',
          },
        ],
      },
      {
        id: 'approach',
        label: 'Approach',
        blocks: [
          {
            type: 'text',
            text: 'Describe the setup, method, or central idea here.',
          },
        ],
      },
      {
        id: 'results',
        label: 'Results',
        blocks: [
          {
            type: 'callout',
            tone: 'highlight',
            title: 'Key takeaway',
            text: 'Summarize the most important result here.',
          },
        ],
      },
    ],
  };
}

function createExperienceTemplate(args: TemplateArgs): GraphNodeContent {
  return {
    ...createBlankTemplate(args),
    sections: [
      {
        id: 'overview',
        label: 'Overview',
        blocks: [
          {
            type: 'text',
            text: args.summary || 'Describe the role, scope, and context.',
          },
        ],
      },
      {
        id: 'work',
        label: 'Work',
        blocks: [
          {
            type: 'list',
            items: ['Responsibility', 'Project', 'Outcome'],
          },
        ],
      },
      {
        id: 'reflection',
        label: 'Reflection',
        blocks: [
          {
            type: 'quote',
            text: 'What did this period change about how you work or think?',
          },
        ],
      },
    ],
  };
}

function createTravelTemplate(args: TemplateArgs): GraphNodeContent {
  return {
    ...createBlankTemplate(args),
    sections: [
      {
        id: 'overview',
        label: 'Overview',
        blocks: [
          {
            type: 'text',
            text: args.summary || 'Set the scene for the trip here.',
          },
        ],
      },
      {
        id: 'photographs',
        label: 'Photographs',
        blocks: [
          {
            type: 'gallery',
            align: 'height',
            columns: 2,
            items: [
              {
                src: 'assets/example.jpg',
                alt: 'Describe the image',
              },
            ],
          },
        ],
      },
    ],
  };
}

function createWritingTemplate(args: TemplateArgs): GraphNodeContent {
  return {
    ...createBlankTemplate(args),
    sections: [
      {
        id: 'overview',
        label: 'Overview',
        blocks: [
          {
            type: 'text',
            text: args.summary || 'Summarize the argument or thread here.',
          },
        ],
      },
      {
        id: 'links',
        label: 'Links',
        blocks: [
          {
            type: 'link',
            label: 'Published version',
            href: 'https://example.com',
          },
        ],
      },
    ],
  };
}

function createProjectTemplate(args: TemplateArgs): GraphNodeContent {
  return {
    ...createBlankTemplate(args),
    sections: [
      {
        id: 'overview',
        label: 'Overview',
        blocks: [
          {
            type: 'text',
            text: args.summary || 'Describe the project and its purpose.',
          },
        ],
      },
      {
        id: 'build',
        label: 'Build',
        blocks: [
          {
            type: 'list',
            items: ['Problem', 'Approach', 'Implementation', 'Outcome'],
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
  const args: TemplateArgs = {
    title: draft.title || 'Untitled node',
    subtitle: draft.subtitle || undefined,
    summary: draft.summary || 'Short summary goes here.',
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
