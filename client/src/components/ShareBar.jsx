import { useToast } from './useToast.js';

function shareTargets(url, title) {
  const text = `${title} ${url}`;
  return [
    ['WhatsApp', `https://wa.me/?text=${encodeURIComponent(text)}`],
    ['Email', `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`],
  ];
}

export function ShareBar({ url, title, note }) {
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied.');
    } catch {
      toast('Could not copy the link.', 'warn');
    }
  }

  async function nativeShare() {
    try {
      if (navigator.share) await navigator.share({ title, url });
      else await copy();
    } catch (error) {
      if (error?.name === 'AbortError') return;
      toast('Could not open the share sheet.', 'warn');
    }
  }

  return (
    <div className="share-bar">
      <p className="kicker">Share</p>
      {note ? <p className="meta">{note}</p> : null}
      <div className="actions">
        <button type="button" className="btn btn-ghost btn-small" onClick={nativeShare}>Share</button>
        <button type="button" className="btn btn-ghost btn-small" onClick={copy}>Copy link</button>
        {shareTargets(url, title).map(([label, href]) => (
          <a key={label} className="btn btn-ghost btn-small" href={href} target={label === 'Email' ? undefined : '_blank'} rel="noreferrer">{label}</a>
        ))}
      </div>
    </div>
  );
}
