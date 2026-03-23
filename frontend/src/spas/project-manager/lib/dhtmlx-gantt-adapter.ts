import { gantt } from "../../../../../dhtmlx-gantt/codebase/dhtmlxgantt.es.js";
import "../../../../../dhtmlx-gantt/codebase/dhtmlxgantt.css";

import { injectGgtcTaskAttributesIntoSerializedXml } from "./ggtc-dhtmlx-gantt-xml-serialize.js";

let didInstallGgtcXmlSerializeExtension = false;
let hasConfiguredDhtmlxGantt = false;

function configureExportApiPlugin() {
  gantt.plugins({
    export_api: true,
  });
}

/**
 * DHTMLX stock `gantt.xml.serialize` omits custom task fields and sometimes `type`. We replace it once so
 * `gantt.serialize("xml")` reflects runtime task state (GGTC attrs + `type`) from `getTask()`.
 *
 * This is **not** “save-button enrichment”: the PM Save action never calls `injectGgtcTaskAttributesIntoSerializedXml`
 * directly; it only takes `getSerializedXml()` (which uses `gantt.serialize`) and then `persistChart` runs
 * `scanXmlForMissingExtensionAttrs` as an enforcement gate. The merge does not apply defaults—see
 * `ggtc-dhtmlx-gantt-xml-serialize.ts`.
 */
function ensureGgtcXmlSerializeExtensionInstalled(): void {
  if (didInstallGgtcXmlSerializeExtension) {
    return;
  }

  const xmlApi = gantt.xml as { serialize: () => string };
  const originalXmlSerialize = xmlApi.serialize.bind(xmlApi);
  xmlApi.serialize = function ggtcWrappedGanttXmlSerialize(): string {
    const baseXml = originalXmlSerialize();
    return injectGgtcTaskAttributesIntoSerializedXml(baseXml, gantt);
  };
  didInstallGgtcXmlSerializeExtension = true;
}

function ensureConfiguredDhtmlxGantt() {
  if (hasConfiguredDhtmlxGantt) {
    return;
  }

  configureExportApiPlugin();
  ensureGgtcXmlSerializeExtensionInstalled();
  hasConfiguredDhtmlxGantt = true;
}

export function getDhtmlxGantt() {
  ensureConfiguredDhtmlxGantt();
  return gantt;
}
