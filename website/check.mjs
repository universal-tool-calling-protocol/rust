import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { docs, protocols, quickstart, helloScript, localManual, VERSION } from './data.js';

const root = new URL('./', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const cargo = await read('../Cargo.toml');
assert.equal(VERSION, cargo.match(/^version = "([^"]+)"/m)[1], 'Website version must match the crate');
assert.equal(protocols.length, 12);
assert.equal(new Set(protocols.map(({ id }) => id)).size, 12);
assert.equal(new Set(docs.map(({ id }) => id)).size, docs.length);

for (const protocol of protocols) {
  const manual = JSON.parse(protocol.manual);
  assert.ok(manual.info.title && manual.info.version && manual.manual_version && manual.utcp_version);
  assert.deepEqual(manual.allowed_communication_protocols, [protocol.id]);
  for (const tool of manual.tools) {
    assert.ok(tool.description && tool.inputs.type && tool.outputs.type);
    assert.equal(tool.tool_call_template.call_template_type, protocol.id);
    assert.ok(tool.tool_call_template.name);
    for (const input of tool.inputs.required) assert.ok(tool.inputs.properties[input]);
    const qualifiedName = tool.tool_call_template.name + '.' + tool.name;
    assert.ok(protocol.code.includes('"' + qualifiedName + '"'));
    assert.ok(protocol.codeMode.includes('"' + qualifiedName + '"'));
  }
  assert.ok(protocol.code.includes('#[tokio::main]') && protocol.code.includes('async fn main()'));
  assert.ok(protocol.code.includes(protocol.id + '.manual.json'));
  assert.ok(protocol.codeMode.includes('CodeModeUtcp::new(Arc::new(client))'));
  assert.ok(protocol.codeMode.includes('timeout: Some('));
}

const pages = await Promise.all(['index.html', 'docs.html'].map(read));
const content = docs.flatMap(({ blocks }) => blocks.map((block) => block.text || '').concat(
  blocks.flatMap((block) => block.items || [])
)).join('\n');
for (const html of [...pages, content]) {
  assert.doesNotMatch(html, /Ruby|ruby-utcp|Gemfile|Bundler|gem install/);
  for (const [, attribute] of html.matchAll(/(?:href|src)="(\.[^"]*)"/g)) {
    const url = new URL(attribute.replaceAll('&amp;', '&'), 'https://local.example/');
    const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    assert.ok((await stat(new URL(path, root))).isFile(), 'Missing local asset: ' + path);
    if (url.searchParams.has('topic')) {
      assert.ok(docs.some(({ id }) => id === url.searchParams.get('topic')), 'Unknown documentation topic');
    }
    if (url.searchParams.has('protocol')) {
      assert.ok(protocols.some(({ id }) => id === url.searchParams.get('protocol')), 'Unknown protocol');
    }
  }
}

assert.equal((await read('examples/main.rs')).trim(), quickstart.trim(), 'Downloaded Rust example is stale');
assert.equal((await read('examples/tools.manual.json')).trim(), localManual.trim(), 'Downloaded manual is stale');
assert.equal((await read('examples/tools/hello.js')).trim(), helloScript.trim(), 'Downloaded tool is stale');
console.log('Checked 12 protocol manuals, 24 Rust callers, 8 guides, local links, and downloadable examples.');
