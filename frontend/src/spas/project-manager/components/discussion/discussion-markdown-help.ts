const IMAGE_EXAMPLE_ALT_TEXT = "Alt text";
const LINK_EXAMPLE_TEXT = "Link text";

interface AttachmentMarkdownHelpSource {
  idSourceLabel: string;
  urlPrefix: string;
}

function createImageExample(urlPrefix: string): string {
  return `![${IMAGE_EXAMPLE_ALT_TEXT}](${urlPrefix}<attachmentId>)`;
}

function createScopedCommentImageExample(urlPrefix: string): string {
  return `![${IMAGE_EXAMPLE_ALT_TEXT}](${urlPrefix}<commentId>/<attachmentId>)`;
}

function createLinkExample(urlPrefix: string): string {
  return `[${LINK_EXAMPLE_TEXT}](${urlPrefix}<attachmentId>)`;
}

function createScopedCommentLinkExample(urlPrefix: string): string {
  return `[${LINK_EXAMPLE_TEXT}](${urlPrefix}<commentId>/<attachmentId>)`;
}

function createAttachmentHelpSentence(input: {
  idSourceLabel: string;
  isCommentScoped?: boolean;
  urlPrefix: string;
}): string {
  const imageExample = input.isCommentScoped
    ? createScopedCommentImageExample(input.urlPrefix)
    : createImageExample(input.urlPrefix);
  const linkExample = input.isCommentScoped
    ? createScopedCommentLinkExample(input.urlPrefix)
    : createLinkExample(input.urlPrefix);

  return `Use ${imageExample} for images or ${linkExample} for links from ${input.idSourceLabel}.`;
}

export function createJournalAttachmentMarkdownHelpText(
  sources: AttachmentMarkdownHelpSource[],
): string {
  return sources
    .map((source) => createAttachmentHelpSentence({
      idSourceLabel: source.idSourceLabel,
      urlPrefix: source.urlPrefix,
    }))
    .join(" ");
}

export function createCommentAttachmentMarkdownHelpText(input: {
  commentAttachmentUrlPrefix: string;
  parentSources: AttachmentMarkdownHelpSource[];
}): string {
  const parentSentences = input.parentSources.map((source) =>
    createAttachmentHelpSentence({
      idSourceLabel: source.idSourceLabel,
      urlPrefix: source.urlPrefix,
    }));
  const commentSentence = createAttachmentHelpSentence({
    idSourceLabel: "this comment's attachment list",
    isCommentScoped: true,
    urlPrefix: input.commentAttachmentUrlPrefix,
  });

  return [...parentSentences, commentSentence].join(" ");
}
