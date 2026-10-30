import type {CollaborationButton,CollaborationCard,CollaborationPanelData,CollaborationProposal,CollaborationText,DelegationChoice} from '../model/collaboration';
import type {RichBlock} from '../model/rich-text';
import {RichBlockText,RichInlineText} from './rich-text';

export type CollaborationPanelCallbacks={toggle():void;edit(key:string,value:string):void;request(actionId:string):void;command(id:string,command:string):void;history(id:string):void;outcome?(id:string,value:string):void;beginEdit?(id:string):void;editField?(id:string,field:keyof CollaborationProposal,value:string):void;saveEdit?(id:string):void;cancelEdit?(id:string):void;copy(value:string,origin:HTMLElement):void;open(url:string):void;assign?(id:string,delegation:DelegationChoice['delegation']):void};

type TextField='instructions'|'scope'|'outcome'|'exclusions'|'source'|'summary'|'remaining'|'feedback';
const FIELD_LABELS:Readonly<Record<'scope'|'outcome'|'exclusions'|'source'|'remaining'|'feedback',string>>={scope:'Scope',outcome:'Outcome',exclusions:'Excluded',source:'Source',remaining:'Remaining',feedback:'Your note'};
const PROPOSAL_FIELDS=['title','instructions','scope','outcome','exclusions','source'] as const;
const PROPOSAL_LABELS:Readonly<Record<keyof CollaborationProposal,string>>={title:'Title',instructions:'Instructions',scope:'Scope',outcome:'Expected outcome',exclusions:'Excluded',source:'Source'};

interface CardNodes {
 node:HTMLElement;label:HTMLElement;title:HTMLElement;handler:HTMLElement;delegation:HTMLSelectElement;
 blocks:Record<TextField,HTMLElement>;rows:Record<keyof typeof FIELD_LABELS,HTMLElement>;report:HTMLElement;
 header:HTMLElement;primary:HTMLElement;composer:HTMLElement;composerButtons:HTMLElement;outcomeRow:HTMLElement;outcomeButtons:HTMLElement;
 feedback:HTMLTextAreaElement;artifacts:HTMLElement;history:HTMLElement;copy:HTMLButtonElement;historyButton:HTMLButtonElement;resolution:HTMLSelectElement;
 editor:HTMLElement;fields:Record<keyof CollaborationProposal,HTMLTextAreaElement>;editButton:HTMLButtonElement;saveButton:HTMLButtonElement;cancelButton:HTMLButtonElement;signature:string;
}

/** Retain DOM nodes and editor selection; business state lives in the controller. */
export function createCollaborationPanel(document:Document,root:HTMLElement,callbacks:CollaborationPanelCallbacks,iconSvg:(name:string)=>string=()=>''){
 const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
 // Node#appendChild keeps DOM typing independent of the edge runtime's Element declarations.
 const add=(parent:Node,...children:Node[])=>{for(const child of children)parent.appendChild(child);};
 const hidden=(text:string)=>element('span',text,'visually-hidden');
 /** Icon-only control: the label stays in the accessible name, tooltip and text content but is not shown. */
 const iconButton=(icon:string,label:string,className='')=>{const node=element('button','','icon-button'+(className?' '+className:''));node.type='button';node.title=label;node.innerHTML=iconSvg(icon);node.appendChild(element('span',label));return node;};
 const decision=(choice:CollaborationButton)=>{const node=choice.text?element('button',choice.text,choice.slot==='primary'?'primary':'outline'):iconButton(choice.icon??'chevron',choice.label,choice.slot==='header'?'collaboration-stop':'collaboration-send');node.type='button';node.dataset.command=choice.command;node.disabled=choice.disabled;node.setAttribute('aria-label',choice.label);if(choice.text&&choice.text!==choice.label)node.title=choice.label;return node;};
 const blockText=(container:HTMLElement,content:readonly RichBlock[])=>RichBlockText({container,content,placeholder:'',iconSvg,onOpenLink:callbacks.open});

 const heading=element('h3','Work with AI','visually-hidden'),toggle=element('button'),request=element('textarea'),send=iconButton('send','Request assistance','collaboration-send'),cardsRoot=element('div','','collaboration-cards');
 const requestRow=element('div','','collaboration-request');requestRow.innerHTML=iconSvg('proposal');const requestLabel=element('label','','collaboration-request-field');requestLabel.appendChild(hidden('What would you like help with?'));requestLabel.appendChild(request);requestRow.appendChild(requestLabel);requestRow.appendChild(send);
 toggle.type='button';toggle.onclick=callbacks.toggle;request.maxLength=16000;request.rows=1;request.placeholder='Ask AI for help';request.setAttribute('aria-label','Instructions for AI');[heading,toggle,requestRow,cardsRoot].forEach(node=>root.appendChild(node));
 const cards=new Map<string,CardNodes>();

 function createCard(id:string):CardNodes {
  const node=element('article','','collaboration-card');node.dataset.collaborationId=id;
  const header=element('div','','collaboration-head'),mark=element('span','','collaboration-mark'),label=element('p','','collaboration-status'),tools=element('div','','collaboration-tools');
  mark.innerHTML=iconSvg('proposal');label.setAttribute('role','status');
  const editButton=iconButton('edit','Edit proposal'),copy=iconButton('copy','Copy request for AI'),historyButton=iconButton('history','Show recent history');
  add(tools,editButton,copy,historyButton);add(header,mark,label,tools);
  const title=element('h4','','collaboration-title'),handler=element('p','','collaboration-handler');
  const blocks={} as Record<TextField,HTMLElement>,rows={} as Record<keyof typeof FIELD_LABELS,HTMLElement>;
  for(const field of ['instructions','summary'] as const)blocks[field]=element('div','','collaboration-text rich-view');
  const fieldList=(names:readonly (keyof typeof FIELD_LABELS)[])=>{const list=element('dl','','collaboration-fields');for(const name of names){const row=element('div'),term=element('dt',FIELD_LABELS[name]),value=element('dd','','rich-view');add(row,term,value);list.appendChild(row);rows[name]=row;blocks[name]=value;}return list;};
  const proposalFields=fieldList(['scope','outcome','exclusions','source']);
  const report=element('section','','collaboration-report');report.setAttribute('aria-label','Latest report');add(report,blocks.summary,fieldList(['remaining','feedback']));
  const artifacts=element('div','','collaboration-artifacts');
  const editor=element('div','','collaboration-editor'),fields={} as Record<keyof CollaborationProposal,HTMLTextAreaElement>;
  for(const field of PROPOSAL_FIELDS){const fieldLabel=element('label',PROPOSAL_LABELS[field]),input=element('textarea');input.setAttribute('aria-label','Proposal '+field);input.maxLength=field==='title'?200:16000;fieldLabel.appendChild(input);editor.appendChild(fieldLabel);fields[field]=input;}
  const saveButton=element('button','Save proposal changes','primary'),cancelButton=element('button','Cancel editing','outline'),editorActions=element('div','','collaboration-row');
  editor.appendChild(element('p','Saving clears approval.','collaboration-note'));add(editorActions,saveButton,cancelButton);editor.appendChild(editorActions);
  const primary=element('div','','collaboration-row'),delegationLabel=element('label','','collaboration-delegation'),delegation=element('select');add(delegationLabel,hidden('Who should do this'),delegation);primary.appendChild(delegationLabel);
  const composer=element('div','','collaboration-composer'),feedback=element('textarea'),composerButtons=element('div','','collaboration-composer-actions');feedback.maxLength=16000;feedback.rows=1;feedback.placeholder='Reply to AI';feedback.setAttribute('aria-label','Changes or response');add(composer,feedback,composerButtons);
  const outcomeRow=element('div','','collaboration-row'),resolution=element('select'),outcomeButtons=element('div','','collaboration-row');
  resolution.setAttribute('aria-label','Verified outcome');for(const value of ['unknown','success','partial','failed']){const option=element('option',value==='unknown'?'Still unknown':value==='success'?'Verified success':value==='partial'?'Verified partial result':'Verified failure or no effect');option.value=value;resolution.appendChild(option);}
  add(outcomeRow,resolution,outcomeButtons);
  const history=element('div','','collaboration-history');
  for(const button of [editButton,copy,historyButton,saveButton,cancelButton])button.type='button';
  add(node,header,title,handler,blocks.instructions,proposalFields,report,artifacts,editor,primary,composer,outcomeRow,history);cardsRoot.appendChild(node);
  return {node,label,title,handler,delegation,blocks,rows,report,header:tools,primary,composer,composerButtons,outcomeRow,outcomeButtons,feedback,artifacts,history,copy,historyButton,resolution,editor,fields,editButton,saveButton,cancelButton,signature:''};
 }

 function renderText(card:CardNodes,text:CollaborationText){
  RichInlineText({container:card.title,content:text.title,placeholder:'Untitled proposal',iconSvg,onOpenLink:callbacks.open});
  for(const field of ['instructions','summary'] as const){blockText(card.blocks[field],text[field]);card.blocks[field].hidden=!text[field].length;}
  for(const field of Object.keys(card.rows) as (keyof typeof FIELD_LABELS)[]){blockText(card.blocks[field],text[field]);card.rows[field].hidden=!text[field].length;}
  card.report.hidden=!text.summary.length&&!text.remaining.length&&!text.feedback.length;
 }

 return {focusRequest(){if(!request.closest('[hidden]'))request.focus();},render(data:CollaborationPanelData){
  root.hidden=!data.enabled;if(!data.enabled)return;
  toggle.hidden=!data.showToggle;toggle.textContent=data.showAll?'Show selected action':`All proposals and reports (${data.count})`;toggle.setAttribute('aria-pressed',String(data.showAll));
  requestRow.hidden=!data.action||!data.requestAvailable;request.disabled=data.busy;send.disabled=data.requestDisabled||!data.request.trim();
  if(request.value!==data.request)request.value=data.request;
  request.oninput=()=>{if(data.action)callbacks.edit('action:'+data.action.id,request.value);};send.onclick=()=>{if(data.action)callbacks.request(data.action.id);};
  const keep=new Set(data.cards.map(card=>card.record.id));for(const [id,card] of cards)if(!keep.has(id)){card.node.remove();cards.delete(id);}
  for(const item of data.cards)renderCard(item,data);
 }};

 function renderCard(item:CollaborationCard,data:CollaborationPanelData){
  const r=item.record;let card=cards.get(r.id);if(!card){card=createCard(r.id);cards.set(r.id,card);}const nodes=card;
  nodes.editor.hidden=!item.edit;nodes.editButton.hidden=Boolean(item.edit);nodes.editButton.disabled=item.editDisabled;nodes.editButton.onclick=()=>callbacks.beginEdit?.(r.id);nodes.saveButton.disabled=item.editDisabled;nodes.cancelButton.disabled=data.busy;nodes.saveButton.onclick=()=>callbacks.saveEdit?.(r.id);nodes.cancelButton.onclick=()=>callbacks.cancelEdit?.(r.id);
  for(const field of PROPOSAL_FIELDS){const input=nodes.fields[field],value=item.edit?.proposal[field]??r.proposal[field];if(input.value!==value)input.value=value;input.disabled=item.editDisabled;input.oninput=()=>callbacks.editField?.(r.id,field,input.value);}
  nodes.handler.textContent=[item.delegation.runner,r.last_reported_at&&'Last report '+r.last_reported_at].filter(Boolean).join(' · ');nodes.handler.hidden=!nodes.handler.textContent;
  {const choices=item.delegation.choices,signature=JSON.stringify(choices.map(choice=>choice.label));if(nodes.delegation.dataset.signature!==signature){nodes.delegation.replaceChildren(...choices.map((choice,index)=>{const option=element('option',choice.label);option.value=String(index);return option;}));nodes.delegation.dataset.signature=signature;}nodes.delegation.value=String(item.delegation.selected);nodes.delegation.disabled=data.busy;nodes.delegation.onchange=()=>{const choice=choices[Number(nodes.delegation.value)];if(choice)callbacks.assign?.(r.id,choice.delegation);};}
  nodes.label.textContent=item.label;renderText(nodes,item.text);
  if(nodes.feedback.value!==item.feedback)nodes.feedback.value=item.feedback;
  nodes.resolution.value=item.reconciliation??'unknown';nodes.resolution.disabled=data.busy;nodes.resolution.onchange=()=>callbacks.outcome?.(r.id,nodes.resolution.value);
  nodes.feedback.disabled=data.busy;nodes.feedback.oninput=()=>callbacks.edit(r.id,nodes.feedback.value);
  const slots=(slot:CollaborationButton['slot'])=>item.buttons.filter(choice=>choice.slot===slot);
  const signature=JSON.stringify([item.buttons,r.artifacts,item.history]);
  if(nodes.signature!==signature){
   const place=(container:HTMLElement,choices:readonly CollaborationButton[])=>choices.map(choice=>{const button=decision(choice);button.onclick=()=>callbacks.command(r.id,choice.command);container.appendChild(button);return button;});
   for(const node of [...nodes.primary.querySelectorAll('[data-command]'),...nodes.header.querySelectorAll('[data-command]')])node.remove();nodes.composerButtons.replaceChildren();nodes.outcomeButtons.replaceChildren();
   place(nodes.primary,slots('primary'));place(nodes.header,slots('header'));place(nodes.composerButtons,slots('composer'));place(nodes.outcomeButtons,slots('outcome'));
   nodes.artifacts.replaceChildren(...r.artifacts.map(artifact=>{const button=element('button','','collaboration-link');button.type='button';button.innerHTML=iconSvg('document');button.appendChild(element('span',artifact.label));button.onclick=()=>callbacks.open(artifact.url);return button;}));
   nodes.history.replaceChildren(...item.history.map(entry=>element('p',`${entry.record.updated_at} · ${entry.actor.kind==='user'?'User':'Client'} · ${entry.command} · proposal ${entry.record.version}\n${entry.record.proposal.scope}\n${entry.record.feedback||entry.record.summary}`)));
   nodes.signature=signature;
  }
  nodes.composer.hidden=!item.buttons.some(choice=>choice.slot==='composer'||choice.slot==='outcome');nodes.outcomeRow.hidden=item.reconciliation===null;nodes.artifacts.hidden=!r.artifacts.length;
  nodes.copy.onclick=()=>callbacks.copy(item.handoff,nodes.copy);nodes.historyButton.disabled=data.busy;nodes.historyButton.onclick=()=>callbacks.history(r.id);
 }
}
