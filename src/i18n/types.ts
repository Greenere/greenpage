import { EN_MESSAGES } from './locales/en';

type DeepWiden<T> =
  T extends (...args: infer Args) => infer ReturnType
    ? (...args: Args) => ReturnType
    : T extends string
      ? string
      : T extends readonly (infer Item)[]
        ? ReadonlyArray<DeepWiden<Item>>
        : T extends object
          ? { [Key in keyof T]: DeepWiden<T[Key]> }
          : T;

export type LocaleMessages = DeepWiden<typeof EN_MESSAGES>;
