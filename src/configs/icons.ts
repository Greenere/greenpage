export type ConfigurableIcon =
  | {
      kind: 'unicode';
      glyph: string;
      size: {
        idle: number;
        active: number;
      };
      fontFamily?: string;
      fontWeight?: number | string;
    }
  | {
      kind: 'svg';
      size: {
        idle: number;
        active: number;
      };
      viewBox: string;
      strokeWidth?: number;
      fill?: string;
      stroke?: string;
      fillRule?: 'evenodd' | 'nonzero';
      strokeLinecap?: 'butt' | 'round' | 'square';
      strokeLinejoin?: 'miter' | 'round' | 'bevel';
      paths: string[];
    };

export const EDIT_RELATION_ICON: ConfigurableIcon = {
  kind: 'svg',
  size: {
    idle: 15,
    active: 20,
  },
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  stroke: 'none',
  strokeWidth: 0,
  fillRule: 'evenodd',
  paths: [
    'M12 3A9 9 0 1 1 12 21A9 9 0 1 1 12 3ZM8.2 7.1H16V9.2H10.5V10.9H14.7V13H10.5V14.8H16V16.9H8.2Z',
  ],
};
