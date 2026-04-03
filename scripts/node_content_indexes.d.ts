export type GenerateNodeContentIndexesOptions = {
  rootDir?: string;
  log?: ((message: string) => void) | null;
};

export function generateNodeContentIndexes(
  options?: GenerateNodeContentIndexesOptions,
): Promise<void>;
