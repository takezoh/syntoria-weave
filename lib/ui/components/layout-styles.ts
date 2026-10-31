/** Shared viewport, chrome and scroll ownership; breakpoints only change placement. */
export const layoutStyles = String.raw`
html,body{height:100%;overflow:hidden;overscroll-behavior-y:none}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
main{display:flex;flex-direction:column;height:100dvh;min-height:0;max-width:1600px;margin:auto;overflow:hidden;padding:var(--host-safe-area-top) var(--host-safe-area-right) var(--host-safe-area-bottom) var(--host-safe-area-left)}
main>header{position:relative;z-index:20;display:flex;flex:0 0 auto;align-items:center;justify-content:space-between;gap:8px;min-height:64px;padding:12px 30px;border-bottom:1px solid var(--line);background:var(--surface)}
.header-navigation{flex:1;min-width:0}
.header-navigation h1{min-width:0}
#scopeTitle{min-width:0;max-width:460px}
.header-actions{flex-wrap:nowrap}
#displayStatus{flex:none}
.workspace,.workspace.has-editor{display:grid;flex:1 1 0;min-height:0;overflow:hidden;align-items:stretch;grid-template-columns:220px minmax(0,1fr)}
.workspace.has-editor{grid-template-columns:220px minmax(0,1fr) 380px}
.list-panel{position:relative;min-width:0;min-height:0;overflow-y:auto;overscroll-behavior-y:contain;overflow-anchor:none;-webkit-overflow-scrolling:touch;padding:28px clamp(16px,3vw,40px) 24px}
.view-rail{display:flex;flex-direction:column;gap:4px;min-width:0;min-height:0;overflow-y:auto;overscroll-behavior-y:contain;padding:10px 12px;border-right:1px solid var(--line);background:var(--rail)}
.view-rail button{flex-shrink:0;justify-content:flex-start;gap:10px;min-width:0;min-height:40px;width:100%;height:auto;padding:8px 12px;color:var(--fg);font-weight:500;white-space:normal;overflow-wrap:anywhere;text-align:left}
.view-rail button svg{width:18px;height:18px;color:var(--muted)}
.rail-label{flex:1;min-width:0;text-align:left;overflow-wrap:anywhere}
.rail-functions{display:flex;flex-direction:column;gap:4px;flex:none}
.rail-functions button,.view-rail .rail-sign-out{position:relative;justify-content:flex-start;width:100%;min-width:0;min-height:40px;height:auto;padding:8px 12px}
.rail-functions .rail-label,.rail-sign-out .rail-label{position:static;width:auto;height:auto;overflow:visible;white-space:normal}
.rail-perspectives{flex:none;margin-top:10px;padding-top:6px;border-top:1px solid var(--line);min-width:0}
.rail-perspectives>p{padding:0 12px 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
#railPerspectiveButtons{display:grid;gap:2px;min-width:0}
.view-rail .rail-sign-out{margin-top:auto;color:var(--muted)}
.editor-panel{display:none;min-width:0;min-height:0;overflow:hidden;border-left:1px solid var(--line);background:var(--surface)}
.workspace.has-editor .editor-panel{display:flex;flex-direction:column}
#editor:not([hidden]),#catalogEditor:not([hidden]){display:flex;flex:1 1 0;flex-direction:column;min-height:0;overflow:hidden}
.detail-content{position:relative;display:block;flex:1 1 0;min-height:0;overflow-y:auto;overscroll-behavior-y:contain;overflow-anchor:none;-webkit-overflow-scrolling:touch}
.action-detail-content{padding:12px 20px 24px}
.action-detail-content>*+*{margin-top:12px}
.catalog-detail-content{padding:18px 20px 24px}
.editor-toolbar,.catalog-toolbar{position:relative;z-index:4;flex:0 0 auto;display:flex;align-items:center;gap:2px;margin:0;padding:8px 10px;background:var(--surface);border-bottom:1px solid var(--line)}
.catalog-toolbar .editor-title{flex:1;min-width:0;margin:0;justify-content:space-between}
#backToList,#catalogBack{display:none}
#closeEditor{color:var(--muted)}
.feedback-host:empty{display:none}
.contextual-feedback{margin:0 0 12px;padding:10px 12px;border:1px solid var(--line);border-radius:9px;overflow-wrap:anywhere;background:var(--surface);font-size:12px}
.contextual-feedback p{margin:0 0 6px}
#operationNotice,#advisoryNotice{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 10px}
#operationNotice>p,#advisoryNotice>p{flex:1 1 10ch;min-width:0;margin:0}
#operationNotice .icon-button,#advisoryNotice .icon-button{flex:0 0 36px;width:36px;padding:6px}
.contextual-feedback button{min-height:36px;padding:6px 8px}
#operationFailure,#unknown{border-color:var(--warning);color:var(--warning)}
#retained{display:grid;gap:4px;margin:0;padding:0;border:0}
#retained button{justify-content:flex-start;text-align:left;white-space:normal;overflow-wrap:anywhere}
#localSaveFeedback{color:var(--muted);border:0;padding:0}
#refresh[data-state="refreshing"]>svg{animation:save-spin 1s linear infinite}
@media(max-width:1100px){
.workspace,.workspace.has-editor{grid-template-columns:208px minmax(0,1fr)}
.workspace.has-editor{grid-template-columns:208px minmax(0,1fr) 340px}
.list-panel{padding:28px 20px 24px}
}
@media(max-width:850px){
main>header{min-height:58px;padding:10px 16px}
main[data-mobile-screen="action"]>header,main[data-mobile-screen="catalog"]>header{display:none}
#scopeTitle{max-width:none}
.workspace,.workspace.has-editor{display:flex;flex-direction:column}
.list-panel{flex:1 1 0;padding:20px 16px 24px}
.workspace.has-editor .editor-panel{flex:1 1 0;border:0}
.view-rail{display:none}
.view-rail[data-open="true"]{display:flex;position:fixed;z-index:30;top:calc(var(--host-safe-area-top) + var(--widget-header-height));left:var(--host-safe-area-left);right:var(--host-safe-area-right);max-height:calc(100dvh - var(--host-safe-area-top) - var(--host-safe-area-bottom) - var(--widget-header-height));padding:8px 12px 12px;border-right:0;border-bottom:1px solid var(--line);background:var(--surface);box-shadow:0 16px 32px #15171c2e}
.rail-functions{display:flex;flex-direction:column;gap:2px}
.rail-functions button,.view-rail .rail-sign-out{justify-content:flex-start;width:100%;height:auto;min-height:44px;padding:8px 12px}
.rail-functions .rail-label,.rail-sign-out .rail-label{position:static;width:auto;height:auto;overflow:visible;clip-path:none;white-space:normal}
.view-rail .rail-sign-out{margin-top:10px;border-top:1px solid var(--line);border-radius:0}
.action-detail-content{padding:12px 16px 24px}
.catalog-detail-content{padding:18px 16px 24px}
.editor-toolbar,.catalog-toolbar{padding:6px 8px}
#backToList{display:inline-flex;margin:0 4px 0 0;padding:0;color:var(--fg);font-size:inherit}
#catalogBack{display:inline-flex;flex:none;margin:0 4px 0 0;padding:0 8px;color:var(--fg)}
.catalog-toolbar .editor-title{justify-content:flex-end}
#closeEditor{display:none}
}
`;
