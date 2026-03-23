import {
  GGTC_TASK_CLOSED_REASON_ATTRIBUTE,
  GGTC_TASK_DESCRIPTION_ATTRIBUTE,
  GGTC_TASK_STATUS_ATTRIBUTE,
} from "./ggtc-dhtmlx-gantt-extensions-manager.js";

const XML_MIME_TYPE = "application/xml";
const XML_PARSER_ERROR_SELECTOR = "parsererror";
const XML_TASK_SELECTOR = "task";

export interface GanttInstanceForGgtcXmlInjection {
  getTask: (id: string | number) => GanttRuntimeTaskForXmlSerialization;
}

type GanttRuntimeTaskForXmlSerialization = {
  ggtc_task_closed_reason?: string | null;
  ggtc_task_description?: string | null;
  ggtc_task_status?: string | null;
  type?: string;
};

function parseSerializedXmlDocument(serializedXml: string): XMLDocument | null {
  const xmlDocument = new DOMParser().parseFromString(serializedXml, XML_MIME_TYPE);
  if (xmlDocument.querySelector(XML_PARSER_ERROR_SELECTOR)) {
    return null;
  }
  return xmlDocument;
}

function setTaskNodeAttribute(taskElement: Element, name: string, value: string | null | undefined): void {
  if (typeof value !== "string") {
    return;
  }
  taskElement.setAttribute(name, value);
}

function setTaskNodeTypeAttribute(taskElement: Element, type: GanttRuntimeTaskForXmlSerialization["type"]): void {
  if (typeof type !== "string" || type.trim().length === 0) {
    return;
  }
  taskElement.setAttribute("type", type);
}

function getRuntimeTask(
  ganttInstance: GanttInstanceForGgtcXmlInjection,
  taskId: string,
): GanttRuntimeTaskForXmlSerialization | null {
  try {
    return ganttInstance.getTask(taskId);
  } catch {
    return null;
  }
}

/**
 * Copies GGTC extension fields and DHTMLX `type` from live task objects onto XML task nodes.
 * Does **not** call `ensureTaskObjectAttrs` or any other defaulting: if hooks failed to populate
 * the in-memory task, attributes are omitted and `GgtcDhtmlxGanttExtensionsManager.scanXmlForMissingExtensionAttrs`
 * at persist time can surface the gap.
 */
function mergeRuntimeTaskFieldsIntoTaskElement(
  taskElement: Element,
  runtimeTask: GanttRuntimeTaskForXmlSerialization,
): void {
  setTaskNodeTypeAttribute(taskElement, runtimeTask.type);
  setTaskNodeAttribute(taskElement, GGTC_TASK_STATUS_ATTRIBUTE, runtimeTask.ggtc_task_status);
  setTaskNodeAttribute(taskElement, GGTC_TASK_CLOSED_REASON_ATTRIBUTE, runtimeTask.ggtc_task_closed_reason);
  setTaskNodeAttribute(taskElement, GGTC_TASK_DESCRIPTION_ATTRIBUTE, runtimeTask.ggtc_task_description);
}

/**
 * Merges GGTC extension fields and DHTMLX `type` from live task objects into serialized chart XML.
 * Invoked from the DHTMLX `gantt.xml.serialize` hook in `dhtmlx-gantt-adapter.ts`. This is **library serialization**,
 * not the Save button: the Save / persist path must not call this module—only `gantt.serialize("xml")` does, and
 * `useGanttChartFileManager.persistChart` runs enforcement scan on the result.
 */
export function injectGgtcTaskAttributesIntoSerializedXml(
  serializedXml: string,
  ganttInstance: GanttInstanceForGgtcXmlInjection,
): string {
  const xmlDocument = parseSerializedXmlDocument(serializedXml);
  if (!xmlDocument) {
    return serializedXml;
  }

  Array.from(xmlDocument.querySelectorAll(XML_TASK_SELECTOR)).forEach((taskElement) => {
    const taskId = taskElement.getAttribute("id")?.trim();
    if (!taskId) {
      return;
    }
    const runtimeTask = getRuntimeTask(ganttInstance, taskId);
    if (!runtimeTask) {
      return;
    }
    mergeRuntimeTaskFieldsIntoTaskElement(taskElement, runtimeTask);
  });

  return new XMLSerializer().serializeToString(xmlDocument);
}
