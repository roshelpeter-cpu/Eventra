const KEY = 'eventra-saved';

export function readSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function isSaved(slug) {
  return readSaved().includes(slug);
}

export function toggleSaved(slug) {
  const current = readSaved();
  const next = current.includes(slug) ? current.filter((item) => item !== slug) : [slug, ...current];
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('eventra-saved'));
  return next.includes(slug);
}

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
