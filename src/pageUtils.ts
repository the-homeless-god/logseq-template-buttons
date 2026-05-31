import type { PageEntity } from "@logseq/libs/dist/LSPlugin";

export function isRegularPage(page: PageEntity) {
  if (page["journal?"]) {
    return false;
  }

  const name = page.originalName || page.name;
  if (!name) {
    return false;
  }

  if (name.startsWith("Template:")) {
    return false;
  }

  return true;
}
