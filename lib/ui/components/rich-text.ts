import type {RichBlock,RichInline,RichListItem} from '../model/rich-text';
import type {DeepReadonly} from '../model/types';

export interface RichTextProps<T> {
  readonly container: HTMLElement;
  readonly content: DeepReadonly<T[]>;
  readonly placeholder: string;
  readonly iconSvg: (name: string) => string;
  readonly onOpenLink: (href: string) => void;
}

// Local rendering caches: unchanged content keeps its nodes, so text selection survives unrelated renders.
const rendered = new WeakMap<HTMLElement, {content: unknown; placeholder: string}>();
const linkHandlers = new WeakMap<HTMLElement, (href: string) => void>();

function appendInline(
  document: Document,
  parent: HTMLElement,
  nodes: DeepReadonly<RichInline[]>,
  container: HTMLElement,
): void {
  for (const node of nodes) {
    if (node.kind === 'text') parent.appendChild(document.createTextNode(node.text));
    else if (node.kind === 'break') parent.appendChild(document.createElement('br'));
    else if (node.kind === 'code') {
      const code = document.createElement('code');
      code.textContent = node.text;
      parent.appendChild(code);
    } else if (node.kind === 'link') {
      const anchor = document.createElement('a');
      anchor.href = node.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.addEventListener('click', event => {
        event.preventDefault();
        linkHandlers.get(container)?.(node.href);
      });
      appendInline(document, anchor, node.children, container);
      parent.appendChild(anchor);
    } else {
      const element = document.createElement(node.kind === 'strong' ? 'strong' : node.kind === 'emphasis' ? 'em' : 's');
      appendInline(document, element, node.children, container);
      parent.appendChild(element);
    }
  }
}

function appendListItem(
  document: Document,
  list: HTMLElement,
  item: DeepReadonly<RichListItem>,
  container: HTMLElement,
  iconSvg: (name: string) => string,
): void {
  const node = document.createElement('li');
  if (item.checked !== null) {
    node.className = 'task-item';
    const box = document.createElement('span');
    box.className = 'task-box';
    box.dataset.checked = String(item.checked);
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', item.checked ? 'Checked' : 'Unchecked');
    box.innerHTML = iconSvg('tick');
    node.appendChild(box);
  }
  const [first, ...rest] = item.blocks;
  if (first?.kind === 'paragraph') appendInline(document, node, first.children, container);
  appendBlocks(document, node, first?.kind === 'paragraph' ? rest : item.blocks, container, iconSvg);
  list.appendChild(node);
}

function appendBlocks(
  document: Document,
  parent: HTMLElement,
  blocks: DeepReadonly<RichBlock[]>,
  container: HTMLElement,
  iconSvg: (name: string) => string,
): void {
  for (const block of blocks) {
    if (block.kind === 'paragraph' || block.kind === 'heading') {
      const element = document.createElement(block.kind === 'paragraph' ? 'p' : block.level === 1 ? 'h5' : 'h6');
      if (block.kind === 'heading') {
        element.className = 'rich-heading';
        element.dataset.level = String(Math.min(block.level, 3));
      }
      appendInline(document, element, block.children, container);
      parent.appendChild(element);
    } else if (block.kind === 'list') {
      const list = document.createElement(block.ordered ? 'ol' : 'ul');
      if (block.ordered && block.start !== 1) list.setAttribute('start', String(block.start));
      for (const item of block.items) appendListItem(document, list, item, container, iconSvg);
      parent.appendChild(list);
    } else if (block.kind === 'quote') {
      const quote = document.createElement('blockquote');
      appendBlocks(document, quote, block.blocks, container, iconSvg);
      parent.appendChild(quote);
    } else if (block.kind === 'code') {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = block.text;
      pre.appendChild(code);
      parent.appendChild(pre);
    } else parent.appendChild(document.createElement('hr'));
  }
}

function renderRichText<T>(props: RichTextProps<T>, append: (document: Document) => void): void {
  const {container, content, placeholder} = props;
  linkHandlers.set(container, props.onOpenLink);
  const previous = rendered.get(container);
  if (previous?.content === content && previous.placeholder === placeholder) return;
  rendered.set(container, {content, placeholder});
  const document = container.ownerDocument;
  container.replaceChildren();
  container.classList.toggle('is-empty', !content.length);
  if (content.length) {
    append(document);
    return;
  }
  const empty = document.createElement('span');
  empty.className = 'text-placeholder';
  empty.textContent = placeholder;
  container.appendChild(empty);
}

/** Single-line rich text such as a Title. */
export function RichInlineText(props: RichTextProps<RichInline>): void {
  renderRichText(props, document => appendInline(document, props.container, props.content, props.container));
}

/** Multi-line rich text such as Notes. */
export function RichBlockText(props: RichTextProps<RichBlock>): void {
  renderRichText(props, document => appendBlocks(document, props.container, props.content, props.container, props.iconSvg));
}
