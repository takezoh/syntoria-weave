import {UI_URI, widgetHtml} from '../widget';

export function createActionUiResource() {
  return {
    uri: UI_URI,
    mimeType: 'text/html;profile=mcp-app',
    text: widgetHtml,
    _meta: {
      ui: {prefersBorder: true, csp: {connectDomains: [], resourceDomains: []}},
      'openai/ui': {availableDisplayModes: ['inline', 'fullscreen']},
      'openai/widgetDescription': 'Structured actions: normal, deferred, completed, details and safe editing.',
    },
  };
}
