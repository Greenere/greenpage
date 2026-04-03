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
    }
  | {
      kind: 'asset-svg';
      src: string;
      tintWithCurrentColor?: boolean;
      size: {
        idle: number;
        active: number;
      };
    };

export const EDIT_RELATION_ICON: ConfigurableIcon = {
  kind: 'asset-svg',
  src: 'assets/icons/editing.svg',
  tintWithCurrentColor: true,
  size: {
    idle: 15,
    active: 20,
  },
};
