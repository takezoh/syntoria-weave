import {createTransientModel} from './model/transient-create';
import {createTreeDropModel} from './model/tree-drop';
import {createPickerModel} from './model/picker';
import {createCatalogTreeModel} from './model/catalog-tree';
import {createOutlineModel} from './model/outline';
import {createCatalogDraftModel} from './model/catalog-drafts';
import {createDateInputModel} from './model/date-input';
import {createMovementModel} from './model/movement';
import {createAutosaveModel} from './model/autosave';
import {createRichTextModel} from './model/rich-text';
import {createUiController} from './application/controller';
import {createDiscardingEffects} from './effects/verification';
import {mutationBlocked,hasUnsavedChanges,editorSelection} from './model/controls';
import {retainRequest,operationSucceeded,createdActionId} from './model/operations';
import {visibleActions,scopeTitle,reviewChangeSummary,errorMessage,warningMessage,actionDepth,displayTitle} from './model/presentation';
import {mergeHostContext,formatTimestamp} from './model/display';
import {createNavigationModel} from './model/navigation';
import {iconSvg} from './model/icons';
import {createToolClient} from './effects/tool-client';
import {mountDom} from './effects/dom.js';
import {createReviewMarkStore} from './effects/review-mark';
import {createHostTransport,createDisplayBridge} from './effects/host';
import {editDraft,discardDraft,mergeDrafts,draftPayload,acknowledgeDraft} from './model/drafts';
import type {HostEffects,MessageEvent as HostMessageEvent,HostMessage} from './ports';
import type {UiDiagnosticCounter,UiDiagnosticPhase,UiDiagnosticsPort} from './effects/diagnostics';

const verification=document.documentElement.dataset.verification==='true';
let effects:HostEffects={
 send:(message:unknown)=>window.parent.postMessage(message,'*'),
 listen:(handler:(event:HostMessageEvent)=>void)=>{
  const fn=(event:globalThis.MessageEvent)=>handler({trusted:event.source===window.parent,message:event.data as HostMessage});
  window.addEventListener('message',fn);
  return ()=>window.removeEventListener('message',fn);
 },
 schedule:(fn:()=>void,ms:number)=>window.setTimeout(fn,ms),
 cancel:(handle:unknown)=>window.clearTimeout(handle as number),
};
if(verification){
 effects=createDiscardingEffects(effects,{
  consume:()=>{const el=document.getElementById('discardNext') as HTMLInputElement|null;if(!el?.checked)return false;el.checked=false;return true;},
  discarded:()=>mounted.controller.notify('verification','Save response discarded for verification. Waiting for the normal timeout.'),
 });
}
const transport=createHostTransport(effects);
const navigation=createNavigationModel(),catalogTree=createCatalogTreeModel();
const model={
 transient:createTransientModel(),treeDrop:createTreeDropModel(),picker:createPickerModel(),
 catalogTree,catalogDrafts:createCatalogDraftModel(),dateInput:createDateInputModel(),outline:createOutlineModel(navigation,catalogTree),
 movement:createMovementModel(),autosave:createAutosaveModel(),richText:createRichTextModel(),createdActionId,displayTitle,formatTimestamp,navigation,
 errorMessage,warningMessage,actionDepth,reviewChangeSummary,iconSvg,visibleActions,scopeTitle,mergeHostContext,
 editorSelection,acknowledgeDraft,draftPayload,mutationBlocked,hasUnsavedChanges,operationSucceeded,retainRequest,
 editDraft,discardDraft,mergeDrafts,
};
const diagnosticCounters:UiDiagnosticCounter[]=['list.render','movement.fingerprint','movement.intent','movement.relevant','movement.target-groups'];
const diagnostics:UiDiagnosticsPort|undefined=document.documentElement.dataset.uiDiagnostics==='true'?{
 increment(counter){const metrics=(window as Window&{__actionToolsMetrics?:Record<UiDiagnosticCounter,number>}).__actionToolsMetrics||Object.fromEntries(diagnosticCounters.map(name=>[name,0])) as Record<UiDiagnosticCounter,number>;(window as Window&{__actionToolsMetrics?:Record<UiDiagnosticCounter,number>}).__actionToolsMetrics=metrics;metrics[counter]++;},
 record(phase:UiDiagnosticPhase,durationMs:number){const target=window as Window&{__actionToolsPhases?:{phase:UiDiagnosticPhase;durationMs:number;at:number}[]};const phases=target.__actionToolsPhases||[];target.__actionToolsPhases=phases;phases.push({phase,durationMs,at:window.performance.now()});},
}:undefined;
// Browser storage can throw on access in sandboxed host frames; the adapter then keeps the mark in memory.
const reviewMarks=createReviewMarkStore(()=>{try{return window.localStorage;}catch{return null;}});
const mounted=mountDom(document,window,transport,{next:()=>crypto.randomUUID()},model,createToolClient,createUiController,createDisplayBridge,diagnostics,reviewMarks);
