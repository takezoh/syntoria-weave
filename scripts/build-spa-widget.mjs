import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {widgetHtml} from '../lib/widget.ts';

const outputDirectory=resolve('dist/spa');
await mkdir(outputDirectory,{recursive:true});
await writeFile(resolve(outputDirectory,'workspace.html'),widgetHtml);
