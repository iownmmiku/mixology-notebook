import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  budgetHistory, MAX_HISTORY_CHARS, MAX_HISTORY_MESSAGES, MAX_RECIPE_CONTEXT_CHARS,
  postChatCompletion, testConnection, validateApiSettings,
} from '../src/api';
import type { ApiSettings, ChatMessage } from '../src/types';

const settings: ApiSettings = { endpoint: ' https://example.com/v1/chat/completions ', apiKey: ' test-only-key ', model: ' test-model ' };
const messages: ChatMessage[] = [{ role: 'user', content: '推荐一杯无酒精饮品' }];
async function withFetch(mock: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { await run(); } finally { globalThis.fetch = original; }
}

test('settings enforce TLS and trim values without making a request', () => {
  assert.equal(validateApiSettings(settings).apiKey, 'test-only-key');
  assert.equal(validateApiSettings(settings).model, 'test-model');
  assert.equal(validateApiSettings({ ...settings, endpoint: 'http://localhost:8080/chat' }).endpoint, 'http://localhost:8080/chat');
  for (const endpoint of ['http://example.com/chat', 'ftp://example.com', 'https://user:password@example.com/chat', 'https://example.com/chat#fragment']) {
    assert.throws(() => validateApiSettings({ ...settings, endpoint }));
  }
  assert.throws(() => validateApiSettings({ ...settings, apiKey: '' }), /请填写/);
});

test('chat payload has bounded history/context and blocks redirect forwarding', async () => {
  const history: ChatMessage[] = Array.from({ length: 40 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: String(index).padEnd(1800, 'x') }));
  history.push({ role: 'user', content: '最新问题' });
  await withFetch(async (url, options) => {
    assert.equal(url, 'https://example.com/v1/chat/completions');
    assert.equal(options?.redirect, 'error');
    assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer test-only-key');
    assert.ok(options?.signal);
    const body = JSON.parse(options!.body as string);
    const submitted = body.messages.slice(1) as ChatMessage[];
    assert.ok(submitted.length <= MAX_HISTORY_MESSAGES);
    assert.ok(submitted.reduce((total, message) => total + message.content.length, 0) <= MAX_HISTORY_CHARS);
    assert.equal(submitted.at(-1)?.content, '最新问题');
    assert.ok(body.messages[0].content.length < MAX_RECIPE_CONTEXT_CHARS + 2400);
    return new Response(JSON.stringify({ choices: [{ message: { content: ' 测试回复 ' } }] }), { status: 200 });
  }, async () => {
    assert.equal(await postChatCompletion(settings, history, ['金酒'], 'r'.repeat(100000)), '测试回复');
  });
});

test('budget keeps latest question even if a single message exceeds the budget', () => {
  const result = budgetHistory([{ role: 'assistant', content: 'old' }, { role: 'user', content: 'x'.repeat(MAX_HISTORY_CHARS + 1000) }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].role, 'user');
  assert.equal(result[0].content.length, MAX_HISTORY_CHARS);
});

test('API status errors explain authorization, rate limits, quota and model problems', async () => {
  for (const [status, data, expected] of [
    [401, { error: { message: 'invalid key test-only-key' } }, /API 密钥无效/],
    [429, { error: { message: 'too many requests' } }, /请求过于频繁/],
    [429, { error: { code: 'insufficient_quota', message: 'billing required' } }, /余额或额度不足/],
    [404, { error: { code: 'model_not_found', message: 'unknown model' } }, /模型不可用/],
    [503, { error: { message: 'temporarily unavailable' } }, /暂时异常/],
  ] as const) {
    await withFetch(async () => new Response(JSON.stringify(data), { status }), async () => {
      await assert.rejects(postChatCompletion(settings, messages, [], ''), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, expected);
        assert.equal(error.message.includes('test-only-key'), false);
        return true;
      });
    });
  }
});

test('successful HTTP with empty or malformed response is not shown as success', async () => {
  for (const data of [{}, { choices: [{ message: { content: '   ' } }] }, { choices: [{ message: { content: 123 } }] }]) {
    await withFetch(async () => new Response(JSON.stringify(data), { status: 200 }), async () => {
      await assert.rejects(postChatCompletion(settings, messages, [], ''), /有效内容|空回复/);
      assert.equal((await testConnection(settings)).ok, false);
    });
  }
});

test('cancellation rejects immediately and aborts fetch while ignoring late results', async () => {
  const controller = new AbortController();
  let submittedSignal: AbortSignal | null | undefined;
  let finish: ((response: Response) => void) | undefined;
  await withFetch((_url, options) => {
    submittedSignal = options?.signal;
    return new Promise((resolve) => { finish = resolve; });
  }, async () => {
    const pending = postChatCompletion(settings, messages, [], '', controller.signal);
    controller.abort();
    await assert.rejects(pending, (error: unknown) => error instanceof Error && error.name === 'AbortError');
    assert.equal(submittedSignal?.aborted, true);
    finish?.(new Response(JSON.stringify({ choices: [{ message: { content: 'late response' } }] }), { status: 200 }));
  });
});

test('a signal aborted before submission avoids any network request', async () => {
  const controller = new AbortController();
  controller.abort();
  await withFetch(async () => { assert.fail('fetch must not run'); }, async () => {
    await assert.rejects(postChatCompletion(settings, messages, [], '', controller.signal), (error: unknown) => error instanceof Error && error.name === 'AbortError');
  });
});

test('connection test validates settings and successful model output using mocks only', async () => {
  let calls = 0;
  await withFetch(async () => {
    calls++;
    return new Response(JSON.stringify({ choices: [{ message: { content: '连接成功' } }] }), { status: 200 });
  }, async () => {
    assert.equal((await testConnection({ ...settings, apiKey: '' })).ok, false);
    assert.equal(calls, 0);
    assert.equal((await testConnection(settings)).ok, true);
    assert.equal(calls, 1);
  });
});
