type StartViewTransition = (update: () => void | Promise<void>) => {
  finished: Promise<void>;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: StartViewTransition;
};

export function navigateWithViewTransition(navigate: () => void) {
  const documentWithTransition = document as DocumentWithViewTransition;

  if (!documentWithTransition.startViewTransition) {
    navigate();
    return;
  }

  documentWithTransition.startViewTransition(() => {
    navigate();
  });
}
