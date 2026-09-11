const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareAssets } = require('../Phone-UI/boot-loader.js');

function fixture() {
  const pending = [];
  class Image {
    set src(value) { this.url = value; pending.push(this); }
    decode() { this.decoded = true; return Promise.resolve(); }
  }
  return { pending, options: { ImageCtor: Image, framework: function Framework7() {}, document: {
    querySelectorAll: () => [{ sheet: {} }, { sheet: {} }],
    fonts: { load: async () => [{}], ready: Promise.resolve() }
  }, timeoutMs: 100 } };
}

test('boot gate waits for every image decode and the icon font', async () => {
  const f = fixture();
  let done = false;
  const ready = prepareAssets(f.options).then(() => { done = true; });
  assert.equal(f.pending.length, 2);
  f.pending[0].onload();
  await Promise.resolve();
  assert.equal(done, false);
  f.pending[1].onload();
  await ready;
  assert.ok(f.pending.every(image => image.decoded));
});

test('failed wallpaper rejects boot, rather than revealing an incomplete screen', async () => {
  const f = fixture();
  const ready = prepareAssets(f.options);
  f.pending[0].onerror();
  await assert.rejects(ready, /image/i);
});

test('missing Framework7 or failed stylesheet rejects readiness', async () => {
  const f = fixture();
  await assert.rejects(prepareAssets({ ...f.options, framework: undefined }), /Framework7/);
  f.options.document.querySelectorAll = () => [{ sheet: null }];
  await assert.rejects(prepareAssets(f.options), /stylesheet/i);
});

test('stalled asset loading has a bounded failure path', async () => {
  const f = fixture();
  await assert.rejects(prepareAssets({ ...f.options, timeoutMs: 5 }), /timed out/i);
});
