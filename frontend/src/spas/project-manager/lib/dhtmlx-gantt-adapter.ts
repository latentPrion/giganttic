import { gantt } from "../../../../../dhtmlx-gantt/codebase/dhtmlxgantt.es.js";
import "../../../../../dhtmlx-gantt/codebase/dhtmlxgantt.css";

let hasConfiguredDhtmlxGantt = false;

function configureExportApiPlugin() {
  gantt.plugins({
    export_api: true,
  });
}

function ensureConfiguredDhtmlxGantt() {
  if (hasConfiguredDhtmlxGantt) {
    return;
  }

  configureExportApiPlugin();
  hasConfiguredDhtmlxGantt = true;
}

export function getDhtmlxGantt() {
  ensureConfiguredDhtmlxGantt();
  return gantt;
}
