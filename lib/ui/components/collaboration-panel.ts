import type {CollaborationProposal} from '../model/collaboration';
import type {CollaborationPanelData} from '../model/collaboration';

/** Retain DOM nodes and editor selection; business state lives in the controller. */
export function createCollaborationPanel(document:Document,root:HTMLElement,callbacks:{toggle():void;edit(key:string,value:string):void;request(actionId:string):void;command(id:string,command:string):void;history(id:string):void;outcome?(id:string,value:string):void;beginEdit?(id:string):void;editField?(id:string,field:keyof CollaborationProposal,value:string):void;saveEdit?(id:string):void;cancelEdit?(id:string):void;copy(value:string):void;open(url:string):void}){
 const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text='')=>{const node=document.createElement(tag);node.textContent=text;return node;};
 const heading=element('h3','Work with AI'),toggle=element('button'),requestLabel=element('label','What would you like help with?'),request=element('textarea'),send=element('button','Request assistance'),cardsRoot=element('div');
 toggle.type='button';toggle.onclick=callbacks.toggle;send.type='button';request.maxLength=16000;request.setAttribute('aria-label','Instructions for AI');requestLabel.appendChild(request);[heading,toggle,requestLabel,send,cardsRoot].forEach(node=>root.appendChild(node));
 const cards=new Map<string,{node:HTMLElement;label:HTMLElement;title:HTMLElement;scope:HTMLElement;outcome:HTMLElement;exclusions:HTMLElement;source:HTMLElement;summary:HTMLElement;feedback:HTMLTextAreaElement;buttons:HTMLElement;artifacts:HTMLElement;history:HTMLElement;copy:HTMLButtonElement;historyButton:HTMLButtonElement;resolution:HTMLSelectElement;editor:HTMLElement;fields:Record<keyof CollaborationProposal,HTMLTextAreaElement>;editButton:HTMLButtonElement;saveButton:HTMLButtonElement;cancelButton:HTMLButtonElement;signature:string}>();
 return {render(data:CollaborationPanelData){
  root.hidden=!data.enabled;if(!data.enabled)return;
  toggle.hidden=!data.showToggle;toggle.textContent=data.showAll?'Show selected action':`All proposals and reports (${data.count})`;toggle.setAttribute('aria-pressed',String(data.showAll));
  requestLabel.hidden=!data.action;send.hidden=requestLabel.hidden;request.disabled=data.busy;send.disabled=data.requestDisabled||!data.request.trim();
  if(request.value!==data.request)request.value=data.request;
  request.oninput=()=>{if(data.action)callbacks.edit('action:'+data.action.id,request.value);};send.onclick=()=>{if(data.action)callbacks.request(data.action.id);};
  const keep=new Set(data.cards.map(card=>card.record.id));for(const [id,card] of cards)if(!keep.has(id)){card.node.remove();cards.delete(id);}
  for(const item of data.cards){
   const r=item.record;let card=cards.get(r.id);
   if(!card){
    const node=element('article');node.className='collaboration-card';node.dataset.collaborationId=r.id;
    const label=element('p'),title=element('h4'),scope=element('p'),outcome=element('p'),exclusions=element('p'),source=element('p'),summary=element('p'),feedback=element('textarea'),buttons=element('div'),artifacts=element('div'),history=element('div'),copy=element('button','Copy request for AI'),historyButton=element('button','Show recent history'),resolution=element('select');
    resolution.setAttribute('aria-label','Verified outcome');for(const value of ['unknown','success','partial','failed']){const option=element('option',value==='unknown'?'Still unknown':value==='success'?'Verified success':value==='partial'?'Verified partial result':'Verified failure or no effect');option.value=value;resolution.appendChild(option);}
    label.setAttribute('role','status');feedback.maxLength=16000;feedback.setAttribute('aria-label','Changes or response');copy.type='button';historyButton.type='button';[label,title,scope,outcome,exclusions,source,summary,artifacts,feedback,resolution,buttons,copy,historyButton,history].forEach(child=>node.appendChild(child));cardsRoot.appendChild(node);
    const editor=element('div'),fields={} as Record<keyof CollaborationProposal,HTMLTextAreaElement>,editButton=element('button','Edit proposal'),saveButton=element('button','Save proposal changes'),cancelButton=element('button','Cancel editing');
    for(const field of ['title','instructions','scope','outcome','exclusions','source'] as const){const label=element('label',field==='outcome'?'Expected outcome':field),input=element('textarea');input.setAttribute('aria-label','Proposal '+field);input.maxLength=field==='title'?200:16000;label.appendChild(input);editor.appendChild(label);fields[field]=input;}
    editor.appendChild(element('p','Saving changes clears approval. Review and approve the edited proposal before work starts.'));
    for(const button of [editButton,saveButton,cancelButton])button.type='button';editor.appendChild(saveButton);editor.appendChild(cancelButton);node.insertBefore(editButton,feedback);node.insertBefore(editor,feedback);
    card={editor,fields,editButton,saveButton,cancelButton,node,label,title,scope,outcome,exclusions,source,summary,feedback,buttons,artifacts,history,copy,historyButton,resolution,signature:''};cards.set(r.id,card);
   }
   card.editor.hidden=!item.edit;card.editButton.hidden=Boolean(item.edit);card.editButton.disabled=item.editDisabled;card.editButton.onclick=()=>callbacks.beginEdit?.(r.id);card.saveButton.disabled=item.editDisabled;card.cancelButton.disabled=data.busy;card.saveButton.onclick=()=>callbacks.saveEdit?.(r.id);card.cancelButton.onclick=()=>callbacks.cancelEdit?.(r.id);
   for(const field of Object.keys(card.fields) as (keyof CollaborationProposal)[]){const input=card.fields[field],value=item.edit?.proposal[field]??r.proposal[field];if(input.value!==value)input.value=value;input.disabled=item.editDisabled;input.oninput=()=>callbacks.editField?.(r.id,field,input.value);}
   card.label.textContent=item.label;card.title.textContent=r.proposal.title;card.scope.textContent='Scope: '+r.proposal.scope;card.outcome.textContent='Expected outcome: '+r.proposal.outcome;card.exclusions.textContent='Excluded: '+(r.proposal.exclusions||'No exclusions recorded');card.source.textContent='Source: '+(r.proposal.source||'Not provided');
   card.summary.textContent=[r.summary,r.remaining&&'Remaining: '+r.remaining,r.feedback&&'Latest instruction: '+r.feedback,r.last_reported_at&&'Last report: '+r.last_reported_at].filter(Boolean).join('\n');
   if(card.feedback.value!==item.feedback)card.feedback.value=item.feedback;
   card.resolution.hidden=item.reconciliation===null;card.resolution.value=item.reconciliation??'unknown';card.resolution.disabled=data.busy;card.resolution.onchange=()=>callbacks.outcome?.(r.id,card!.resolution.value);
   card.feedback.disabled=data.busy;card.feedback.oninput=()=>callbacks.edit(r.id,card!.feedback.value);
   const signature=JSON.stringify([item.buttons,r.artifacts,item.history]);
   if(card.signature!==signature){
    card.buttons.replaceChildren(...item.buttons.map(choice=>{const button=element('button',choice.label);button.type='button';button.dataset.command=choice.command;button.disabled=choice.disabled;button.onclick=()=>callbacks.command(r.id,choice.command);return button;}));
    card.artifacts.replaceChildren(...r.artifacts.map(artifact=>{const button=element('button',artifact.label);button.type='button';button.onclick=()=>callbacks.open(artifact.url);return button;}));
    card.history.replaceChildren(...item.history.map(entry=>element('p',`${entry.record.updated_at} · ${entry.actor.kind==='user'?'User':'Client'} · ${entry.command} · proposal ${entry.record.version}\n${entry.record.proposal.scope}\n${entry.record.feedback||entry.record.summary}`)));
    card.signature=signature;
   }
   card.copy.onclick=()=>callbacks.copy(item.handoff);card.historyButton.disabled=data.busy;card.historyButton.onclick=()=>callbacks.history(r.id);
  }
 }};
}
