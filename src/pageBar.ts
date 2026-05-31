import type { PageEntity } from "@logseq/libs/dist/LSPlugin";
import { escapeHtml } from "./htmlUtils";
import { isRegularPage } from "./pageUtils";
import { getPageButtons } from "./settings";
import { copySocialMarkdownForPage } from "./socialMarkdown";
import { createChildPageFromTemplate } from "./templateLogic";

const PAGE_BAR_KEY = "logseq-template-buttons-pagebar";
const PAGE_BAR_SELECTOR = `#logseq-template-buttons--${PAGE_BAR_KEY}`;
const OVERLAY_ID = "lstb-pagebar-overlay";
const OVERLAY_STYLE_ID = "lstb-pagebar-overlay-styles";

let currentPageName: string | null = null;

function getHostDocument() {
  return parent.document;
}

async function refreshCurrentPage() {
  const page = await logseq.Editor.getCurrentPage();
  if (!page || !("name" in page)) {
    currentPageName = null;
    return;
  }

  const pageEntity = page as PageEntity;
  currentPageName = isRegularPage(pageEntity) ? pageEntity.originalName || pageEntity.name : null;
}

function ensureOverlayStyles(doc: Document) {
  if (doc.getElementById(OVERLAY_STYLE_ID)) {
    return;
  }

  const style = doc.createElement("style");
  style.id = OVERLAY_STYLE_ID;
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
    }

    #${OVERLAY_ID} .lstb-pagebar-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.12);
    }

    #${OVERLAY_ID} .lstb-pagebar-popup {
      position: fixed;
      min-width: 280px;
      max-width: min(360px, calc(100vw - 24px));
      max-height: min(420px, calc(100vh - 24px));
      overflow: auto;
      padding: 8px;
      border-radius: 10px;
      background: var(--ls-primary-background-color, #1a1a1a);
      color: var(--ls-primary-text-color, #e6e6e6);
      border: 1px solid var(--ls-border-color, rgba(127, 127, 127, 0.35));
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    }

    #${OVERLAY_ID} .lstb-pagebar-popup-title {
      padding: 8px 10px 10px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      opacity: 0.6;
    }

    #${OVERLAY_ID} .lstb-pagebar-popup-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 12px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
      font: 14px/1.3 var(--ls-font-family, system-ui, sans-serif);
    }

    #${OVERLAY_ID} .lstb-pagebar-popup-item:hover {
      background: var(--ls-quaternary-background-color, rgba(127, 127, 127, 0.18));
    }

    #${OVERLAY_ID} .lstb-pagebar-popup-item i {
      font-size: 16px;
      opacity: 0.8;
      flex-shrink: 0;
    }
  `;
  doc.head.appendChild(style);
}

function closeOverlay() {
  getHostDocument().getElementById(OVERLAY_ID)?.remove();
}

function isOverlayOpen() {
  return Boolean(getHostDocument().getElementById(OVERLAY_ID));
}

async function positionPopup(popup: HTMLElement) {
  const rect = await logseq.App.queryElementRect(`${PAGE_BAR_SELECTOR} .lstb-pagebar-child-btn`);
  if (!rect) {
    popup.style.top = "72px";
    popup.style.right = "24px";
    return;
  }

  const gap = 8;
  const viewportWidth = parent.innerWidth;
  const viewportHeight = parent.innerHeight;
  const popupWidth = popup.offsetWidth || 280;
  const popupHeight = popup.offsetHeight || 200;

  let top = rect.bottom + gap;
  let left = rect.right - popupWidth;

  if (left < 12) {
    left = 12;
  }
  if (left + popupWidth > viewportWidth - 12) {
    left = viewportWidth - popupWidth - 12;
  }
  if (top + popupHeight > viewportHeight - 12) {
    top = Math.max(12, rect.top - popupHeight - gap);
  }

  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
}

function buildOverlayHtml() {
  const buttons = getPageButtons();
  const items = buttons
    .map((button, index) => {
      return `
        <button type="button" class="lstb-pagebar-popup-item" data-lstb-index="${index}">
          <i class="ti ti-file-description"></i>
          <span>${escapeHtml(button.label)}</span>
        </button>
      `;
    })
    .join("");

  return `
    <div class="lstb-pagebar-backdrop" data-lstb-close="true"></div>
    <div class="lstb-pagebar-popup" role="menu">
      <div class="lstb-pagebar-popup-title">Дочерняя страница</div>
      ${items}
    </div>
  `;
}

async function showOverlay() {
  if (!currentPageName) {
    logseq.App.showMsg("Откройте обычную страницу (не journal)", "warning");
    return;
  }

  const buttons = getPageButtons();
  if (!buttons.length) {
    logseq.App.showMsg("Нет шаблонов для page bar (scope: page или both)", "warning");
    return;
  }

  const doc = getHostDocument();
  closeOverlay();
  ensureOverlayStyles(doc);

  const overlay = doc.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = buildOverlayHtml();

  overlay.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-lstb-close]")) {
      closeOverlay();
      return;
    }

    const item = target.closest("[data-lstb-index]") as HTMLElement | null;
    if (!item) {
      return;
    }

    const index = Number(item.dataset.lstbIndex);
    closeOverlay();
    if (!Number.isNaN(index)) {
      void handlePageBarIndex(index);
    }
  });

  doc.body.appendChild(overlay);

  const popup = overlay.querySelector(".lstb-pagebar-popup") as HTMLElement | null;
  if (popup) {
    await positionPopup(popup);
  }
}

async function handlePageBarIndex(index: number) {
  if (!currentPageName) {
    logseq.App.showMsg("Откройте обычную страницу (не journal)", "warning");
    return;
  }

  const button = getPageButtons()[index];
  if (!button?.template) {
    return;
  }

  const childPattern =
    button.pageName || logseq.settings?.childPageName || "{parent}/{template}.{date}";
  const addBacklink = logseq.settings?.addBacklinkOnParent !== false;

  await createChildPageFromTemplate(currentPageName, button.template, childPattern, {
    addBacklink,
  });
}

function buildPageBarTemplate() {
  const buttons = getPageButtons();
  const disabled = !currentPageName;
  const childTitle = disabled
    ? "Откройте страницу, чтобы создать дочернюю"
    : buttons.length
      ? "Создать дочернюю страницу из шаблона"
      : "Нет шаблонов (scope: page или both)";
  const copyTitle = disabled
    ? "Откройте страницу поста"
    : "Копировать markdown для соцсетей (без фото)";

  return `
    <a
      data-on-click="copyPageSocialMarkdown"
      data-prevent-default="true"
      class="button lstb-pagebar-btn lstb-pagebar-copy-btn${disabled ? " opacity-60" : ""}"
      title="${escapeHtml(copyTitle)}"
    >
      <i class="ti ti-copy"></i>
    </a>
    <a
      data-on-click="togglePageBarMenu"
      data-prevent-default="true"
      class="button lstb-pagebar-btn lstb-pagebar-child-btn${disabled || !buttons.length ? " opacity-60" : ""}"
      title="${escapeHtml(childTitle)}"
    >
      <i class="ti ti-git-branch"></i>
    </a>
  `;
}

function renderPageBar() {
  if (logseq.settings?.pageBarEnabled === false) {
    closeOverlay();
    return;
  }

  logseq.App.registerUIItem("pagebar", {
    key: PAGE_BAR_KEY,
    template: buildPageBarTemplate(),
  });
}

export function refreshPageBar() {
  closeOverlay();
  void refreshCurrentPage().then(renderPageBar);
}

export function registerPageBar() {
  logseq.provideModel({
    async copyPageSocialMarkdown() {
      if (!currentPageName) {
        logseq.App.showMsg("Откройте обычную страницу (не journal)", "warning");
        return;
      }

      await copySocialMarkdownForPage(currentPageName);
    },
    togglePageBarMenu() {
      if (isOverlayOpen()) {
        closeOverlay();
        return;
      }

      void showOverlay();
    },
  });

  logseq.provideStyle(pageBarStyles);

  logseq.App.onRouteChanged(async () => {
    closeOverlay();
    await refreshCurrentPage();
    renderPageBar();
  });

  void refreshCurrentPage().then(renderPageBar);
}

export const pageBarTestHooks = {
  setCurrentPageName(name: string | null) {
    currentPageName = name;
  },
  handlePageBarIndex,
};

export const pageBarStyles = `
  ${PAGE_BAR_SELECTOR},
  ${PAGE_BAR_SELECTOR} .lstb-pagebar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  ${PAGE_BAR_SELECTOR} .lstb-pagebar-btn {
    min-width: 34px;
    min-height: 34px;
    padding: 6px 8px;
    margin: 0 2px;
    border-radius: 8px;
  }

  ${PAGE_BAR_SELECTOR} .lstb-pagebar-copy-btn i.ti {
    font-size: 17px !important;
  }

  ${PAGE_BAR_SELECTOR} .lstb-pagebar-btn i.ti {
    font-size: 18px !important;
    line-height: 1;
    width: 18px;
    height: 18px;
  }
`;
