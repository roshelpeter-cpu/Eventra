export function draftKey(slug) {
  return `eventra-draft:${slug}`;
}

export function readDraft(slug) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(draftKey(slug)) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDraft(slug, draft) {
  sessionStorage.setItem(draftKey(slug), JSON.stringify(draft));
}
