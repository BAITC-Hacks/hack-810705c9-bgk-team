import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

const appRequire = createRequire(new URL('../apps/presentation-layer/package.json', import.meta.url));
const clientRequire = createRequire(appRequire.resolve('@mastra/client-js'));
const uiRequire = createRequire(clientRequire.resolve('@ai-sdk/ui-utils'));
const utilsPath = uiRequire.resolve('@ai-sdk/provider-utils');
const limit = 16 * 1024 * 1024;
const context = { url: 'https://provider.invalid/test', requestBodyValues: {} };

for (const [format, utils] of [
  ['CommonJS', uiRequire('@ai-sdk/provider-utils')],
  ['ESM', await import(pathToFileURL(join(dirname(utilsPath), 'index.mjs')).href)],
]) {
  const schema = utils.validator(value => ({ success: true, value }));
  const handlers = {
    json: utils.createJsonResponseHandler(schema),
    jsonError: utils.createJsonErrorResponseHandler({
      errorSchema: schema,
      errorToMessage: value => value.message,
    }),
    statusError: utils.createStatusCodeErrorResponseHandler(),
  };

  test(`${format}: preserves synchronous parsing and prototype protection`, () => {
    const parsed = utils.safeParseJSON({ text: '{"ok":true}' });
    assert.equal(parsed.success, true);
    assert.deepEqual(parsed.value, { ok: true });
    assert.equal(utils.safeParseJSON({ text: '{"__proto__":{"polluted":true}}' }).success, false);
  });

  for (const [name, handler] of Object.entries(handlers)) {
    test(`${format}/${name}: accepts normal UTF-8 responses`, async () => {
      const result = await handler({ ...context, response: new Response('{"message":"Привет 🌍"}') });
      if (name === 'json') assert.deepEqual(result.value, { message: 'Привет 🌍' });
      else if (name === 'jsonError') assert.equal(result.value.message, 'Привет 🌍');
      else assert.equal(result.value.responseBody, '{"message":"Привет 🌍"}');
    });

    for (const length of [undefined, '1', String(limit + 1)]) {
      test(`${format}/${name}: bounds response bytes (Content-Length=${length ?? 'absent'})`, async () => {
        let cancelled = false;
        let bytesRead = 0;
        const response = new Response(new ReadableStream({
          pull(controller) {
            bytesRead += 1024 * 1024;
            controller.enqueue(new Uint8Array(1024 * 1024));
          },
          cancel() { cancelled = true; },
        }), { headers: length === undefined ? {} : { 'content-length': length } });
        await assert.rejects(handler({ ...context, response }), error => {
          assert.match(error.message, /exceeded maximum size/);
          assert.equal(error.isRetryable, false);
          return true;
        });
        assert.equal(cancelled, true);
        assert.equal(response.body.locked, false);
        // One extra chunk can be queued by the stream, but reading must stop.
        assert.ok(bytesRead <= limit + 2 * 1024 * 1024);
      });
    }
  }

  test(`${format}: accepts the exact byte limit`, async () => {
    const body = '"' + 'x'.repeat(limit - 2) + '"';
    const result = await handlers.json({ ...context, response: new Response(body) });
    assert.equal(result.value.length, limit - 2);
  });

  test(`${format}: releases the reader when the source fails`, async () => {
    const response = new Response(new ReadableStream({
      pull(controller) { controller.error(new Error('source failed')); },
    }));
    await assert.rejects(handlers.json({ ...context, response }), /source failed/);
    assert.equal(response.body.locked, false);
  });
}

test('Mastra legacy partial JSON parsing still works', () => {
  const { parsePartialJson } = clientRequire('@ai-sdk/ui-utils');
  assert.deepEqual(parsePartialJson('{"hello":"world"}'), {
    value: { hello: 'world' }, state: 'successful-parse',
  });
  assert.deepEqual(parsePartialJson('{"hello":"wor'), {
    value: { hello: 'wor' }, state: 'repaired-parse',
  });
  const workerRequire = createRequire(new URL('../apps/workers/package.json', import.meta.url));
  const workerClientRequire = createRequire(workerRequire.resolve('@mastra/client-js'));
  const workerUIRequire = createRequire(workerClientRequire.resolve('@ai-sdk/ui-utils'));
  assert.equal(workerUIRequire.resolve('@ai-sdk/provider-utils'), utilsPath);
});

test('ANSI rendering preserves colors and fuzzy links with patched linkify-it', () => {
  const React = appRequire('react');
  const { renderToStaticMarkup } = appRequire('react-dom/server');
  const Ansi = appRequire('ansi-to-react').default;
  const html = renderToStaticMarkup(React.createElement(Ansi, { linkify: 'fuzzy' },
    '\u001b[31mVisit example.com\u001b[0m'));
  assert.match(html, /href="http:\/\/example.com"/);
  assert.match(html, /color:/);
});

test('Drizzle legacy loader can transpile TypeScript with patched esbuild', () => {
  const drizzleRequire = createRequire(appRequire.resolve('drizzle-kit'));
  const loaderRequire = createRequire(drizzleRequire.resolve('@esbuild-kit/esm-loader'));
  const coreRequire = createRequire(loaderRequire.resolve('@esbuild-kit/core-utils'));
  const esbuild = coreRequire('esbuild');
  assert.equal(esbuild.version, '0.25.12');
  assert.match(esbuild.transformSync('const value: number = 42;', { loader: 'ts' }).code, /value = 42/);
});
