import { cp, mkdir, rm, readFile } from 'node:fs/promises';
import { validateContent } from '../server/core.mjs';
import { clients } from '../server/clients.mjs';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
const mediaContent = JSON.parse(await readFile('content/media-remixed.json', 'utf8'));
validateContent({ website: mediaContent }, clients.find(client => client.id === 'media-remixed'));
console.log('Built client portal. Server credentials are read only by Netlify Functions.');
