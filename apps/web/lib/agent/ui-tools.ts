/**
 * Tools that operate the real UI. The model calls them; the browser executes
 * them (lib/agent/dom.ts) so the user watches every click and keystroke. These
 * schemas are shared by the server (to offer them to the model) and the client
 * (to know which tool calls are its job).
 */
const SAY = {
  type: "string",
  description:
    "Optional spoken narration, ≤6 words, specific to this step (e.g. 'Opening Expenses', 'Recording the expense'). Leave empty for routine field fills.",
};

export const UI_TOOLS = [
  {
    name: "click",
    description:
      "Click an element (link, button, checkbox, tab) by its id from the latest page snapshot. Clicking a save/submit/pay/delete-type button automatically pauses for the user's approval — give a `summary` for those.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Element id from the latest page snapshot." },
        say: SAY,
        summary: {
          type: "string",
          description: "Required for buttons that save/submit/pay/delete: one plain sentence of what will happen, e.g. 'Record a $45.00 office supplies expense paid by card today'.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "type_text",
    description: "Type into a text, number, date, email or search input (or textarea). Replaces what's there. Dates must be YYYY-MM-DD.",
    parameters: {
      type: "object",
      properties: { id: { type: "integer" }, text: { type: "string" }, say: SAY },
      required: ["id", "text"],
    },
  },
  {
    name: "select_option",
    description: "Choose an option in a dropdown (select) by its visible label or value.",
    parameters: {
      type: "object",
      properties: { id: { type: "integer" }, option: { type: "string" }, say: SAY },
      required: ["id", "option"],
    },
  },
  {
    name: "navigate",
    description: "Go to an in-app path like '/expenses/new?type=expense'. Only when no visible link/button gets there — prefer clicking.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Must start with '/'." }, say: SAY },
      required: ["path"],
    },
  },
  {
    name: "scroll",
    description: "Scroll the page to reveal more content.",
    parameters: {
      type: "object",
      properties: { direction: { type: "string", enum: ["up", "down"] } },
      required: ["direction"],
    },
  },
  {
    name: "read_page",
    description: "Return the full visible text of the current page (tables, lists, totals) when the snapshot's text is cut off.",
    parameters: { type: "object", properties: {} },
  },
] as const;

export type UiToolName = (typeof UI_TOOLS)[number]["name"];

const UI_TOOL_NAMES = new Set<string>(UI_TOOLS.map((t) => t.name));

export function isUiTool(name: string): name is UiToolName {
  return UI_TOOL_NAMES.has(name);
}

export function uiToolSchemas() {
  return UI_TOOLS.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}
