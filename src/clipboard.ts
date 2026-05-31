function getHostDocument() {
  try {
    return parent.document;
  } catch {
    return document;
  }
}

function getClipboardTarget() {
  try {
    if (parent.navigator?.clipboard) {
      return parent.navigator.clipboard;
    }
  } catch {
    // fall through to iframe navigator
  }

  return navigator.clipboard;
}

function copyViaTextarea(doc: Document, text: string) {
  const textarea = doc.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "2em";
  textarea.style.height = "2em";
  textarea.style.opacity = "0";
  doc.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = doc.execCommand("copy");
  } catch {
    copied = false;
  }

  doc.body.removeChild(textarea);
  return copied;
}

async function attemptCopy(text: string) {
  const clipboard = getClipboardTarget();
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn("[TemplateButtons] clipboard.writeText failed", error);
    }
  }

  if (copyViaTextarea(getHostDocument(), text)) {
    return true;
  }

  if (copyViaTextarea(document, text)) {
    return true;
  }

  return false;
}

export function showCopyPanel(text: string, onCopied?: () => void) {
  const doc = getHostDocument();
  const overlayId = "lstb-copy-fallback-overlay";

  doc.getElementById(overlayId)?.remove();

  const overlay = doc.createElement("div");
  overlay.id = overlayId;
  overlay.innerHTML = `
    <style>
      #${overlayId} {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      #${overlayId} .lstb-copy-panel {
        width: min(760px, 100%);
        max-height: min(85vh, 800px);
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        border-radius: 12px;
        background: var(--ls-primary-background-color, #1a1a1a);
        color: var(--ls-primary-text-color, #eee);
        border: 1px solid var(--ls-border-color, rgba(127,127,127,.35));
        box-shadow: 0 16px 48px rgba(0,0,0,.35);
      }
      #${overlayId} .lstb-copy-title {
        font: 600 15px/1.3 system-ui, sans-serif;
      }
      #${overlayId} .lstb-copy-hint {
        font: 13px/1.45 system-ui, sans-serif;
        opacity: .8;
      }
      #${overlayId} textarea {
        flex: 1;
        min-height: 320px;
        resize: vertical;
        border-radius: 8px;
        border: 1px solid var(--ls-border-color, rgba(127,127,127,.35));
        background: var(--ls-secondary-background-color, #111);
        color: inherit;
        padding: 12px;
        font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      #${overlayId} .lstb-copy-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      #${overlayId} button {
        border: 0;
        border-radius: 8px;
        padding: 9px 14px;
        cursor: pointer;
        font: 13px/1 system-ui, sans-serif;
        color: inherit;
        background: var(--ls-quaternary-background-color, rgba(127,127,127,.2));
      }
      #${overlayId} button[data-lstb-copy="true"] {
        background: var(--ls-link-text-color, #6b9fff);
        color: #fff;
        font-weight: 600;
      }
    </style>
    <div class="lstb-copy-panel" role="dialog" aria-modal="true">
      <div class="lstb-copy-title">Markdown для соцсетей</div>
      <div class="lstb-copy-hint">Нажмите «Скопировать» или выделите текст и Cmd+C.</div>
      <textarea spellcheck="false"></textarea>
      <div class="lstb-copy-actions">
        <button type="button" data-lstb-close="true">Закрыть</button>
        <button type="button" data-lstb-copy="true">Скопировать</button>
      </div>
    </div>
  `;

  const textarea = overlay.querySelector("textarea") as HTMLTextAreaElement | null;
  const copyButton = overlay.querySelector('[data-lstb-copy="true"]') as HTMLButtonElement | null;

  if (textarea) {
    textarea.value = text;
    window.setTimeout(() => {
      textarea.focus();
      textarea.select();
    }, 0);
  }

  copyButton?.addEventListener("click", async () => {
    const copied = await attemptCopy(text);
    if (copied) {
      onCopied?.();
      overlay.remove();
      return;
    }

    if (textarea) {
      textarea.focus();
      textarea.select();
    }
    logseq.App.showMsg("Выделите текст и нажмите Cmd+C", "warning");
  });

  overlay.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target === overlay || target.closest("[data-lstb-close]")) {
      overlay.remove();
    }
  });

  doc.body.appendChild(overlay);
}

export async function copyTextToClipboard(text: string) {
  const copied = await attemptCopy(text);
  return { ok: copied as boolean, method: copied ? ("auto" as const) : ("manual" as const) };
}
