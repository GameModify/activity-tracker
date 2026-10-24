import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatGPTProject, chatGPTSite, assistantObservation } from '../src/domain/assistant.ts';
import { ingest } from '../src/application/ingest.ts';
import { TrackingRuntime } from '../src/application/runtime.ts';
import { chatGPTLabel } from '../extension/chatgpt-page.ts';
import { isTracked } from '../src/domain/classify.ts';
import { sample, rule, start, withStore } from './fixtures.ts';
import type { Observation } from '../src/domain/contracts.ts';
const id = 'g-p-' + 'a'.repeat(32),
  secondId = 'g-p-' + 'b'.repeat(32);
const projectUrl = 'https://chatgpt.com/g/' + id + '-example-project/c/first-chat';
const project: Partial<Observation> = {
  source: 'chrome',
  app: 'chrome.exe',
  url: projectUrl,
  channel: 'chrome:example:focus',
  idle_timeout_ms: 300000,
};
void test('ChatGPT project identity is independent of chat, slug and query parameters', () => {
  assert.deepEqual(chatGPTProject(projectUrl), { id, name: 'example project' });
  assert.equal(chatGPTProject('https://chatgpt.com/g/' + id + '-renamed/project')?.id, id);
  assert.equal(chatGPTProject('https://chatgpt.com/c/ordinary'), undefined);
  assert.equal(chatGPTProject('https://chatgpt.com/g/g-custom-helper/c/ordinary'), undefined);
  assert.equal(chatGPTSite('https://chatgpt.com.evil.example/g/' + id), false);
  assert.equal(chatGPTSite('http://chatgpt.com/g/' + id), false);
  assert.equal(
    chatGPTProject('https://chatgpt.com/g/' + id + '-%invalid/project')?.name,
    '%invalid',
  );
});
void test('project names use confirmed matching metadata and retain stable resource identity', () => {
  const known = assistantObservation(
    sample(0, { ...project, chatgpt_project: { id, name: 'Тестовый проект' } }),
  );
  assert.equal(known.title, 'Проект ChatGPT: Тестовый проект');
  assert.equal(known.resource_id, 'chatgpt:project:' + id);
  const wrong = assistantObservation(
    sample(0, { ...project, chatgpt_project: { id: secondId, name: 'Wrong' } }),
  );
  assert.equal(wrong.title, 'Проект ChatGPT: example project');
  assert.equal(chatGPTLabel(projectUrl, { id, name: 'Тестовый проект' }), known.title);
});
void test('project rules can assign a readable alias and a specific work category', () => {
  withStore((store) => {
    store.replaceRules([
      rule({
        field: 'resource_id',
        value: 'chatgpt:project:' + id,
        name: 'Research',
        activity: 'science',
      }),
    ]);
    ingest(store, sample(0, project));
    ingest(store, sample(5000, project));
    const interval = store.intervals(0, 10)[0];
    assert.equal(interval?.title, 'Проект ChatGPT: Research');
    assert.equal(interval.activity, 'science');
    const runtime = new TrackingRuntime(store);
    runtime.accept(sample(10000, { ...project, timestamp: Date.now() }));
    assert.equal(runtime.status().assistant?.title, 'Проект ChatGPT: Research');
  });
});
void test('ordinary ChatGPT chats are communication and do not retain their personal titles', () => {
  withStore((store) => {
    const ordinary = {
      ...project,
      url: 'https://chatgpt.com/c/ordinary',
      title: 'Private question',
    };
    ingest(store, sample(0, ordinary));
    ingest(store, sample(5000, ordinary));
    const interval = store.intervals(0, 10)[0];
    assert.equal(interval?.title, 'Общаюсь с ChatGPT');
    assert.equal(interval.activity, 'communication');
    assert.equal(interval.resource_id, 'chatgpt:chat');
  });
});
void test('switching between projects and ordinary chats closes the previous activity immediately', () => {
  withStore((store) => {
    ingest(store, sample(0, project));
    ingest(store, sample(5000, { ...project, url: projectUrl.replace(id, secondId) }));
    ingest(store, sample(10000, { ...project, url: 'https://chatgpt.com/c/ordinary' }));
    const rows = store.intervals(0, 10);
    assert.deepEqual(
      rows.map((row) => row.activity),
      ['projects', 'projects', 'communication'],
    );
    assert.deepEqual(
      rows.map((row) => row.resource_id),
      ['chatgpt:project:' + id, 'chatgpt:project:' + secondId, 'chatgpt:chat'],
    );
    assert.equal(rows[0]?.end_at, start + 5000);
  });
});
void test('desktop ChatGPT and Codex are project work, with one stable title', () => {
  withStore((store) => {
    for (const [index, app] of ['ChatGPT.exe', 'Codex.exe'].entries()) {
      ingest(store, sample(index * 5000, { app, title: 'Different window title' }));
    }
    for (const interval of store.intervals(0, 10)) {
      assert.equal(interval.activity, 'projects');
      assert.equal(interval.title, 'Работа с Codex');
      assert.equal(interval.resource_id, 'codex:desktop');
    }
  });
});
void test('active dictation survives keyboard idle and stopping it never truncates captured time', () => {
  withStore((store) => {
    const app = { app: 'ChatGPT.exe', idle_timeout_ms: 300000 } as const;
    for (let offset = 0; offset <= 600000; offset += 5000)
      ingest(store, sample(offset, { ...app, recording: true, idle_ms: offset }));
    ingest(store, sample(605000, { ...app, recording: false, idle_ms: 605000 }));
    const interval = store.intervals(0, 10)[0];
    assert.equal(interval?.end_at, start + 600000);
    assert.equal(interval.closed, true);
    assert.equal(
      isTracked(sample(600000, { ...app, recording: true, active: false, idle_ms: 600000 })),
      false,
    );
  });
});
void test('idle work stops at five minutes and stale or paused assistant status is cleared', () => {
  withStore((store) => {
    for (let offset = 0; offset <= 300000; offset += 5000)
      ingest(store, sample(offset, { ...project, idle_ms: offset }));
    assert.equal(store.intervals(0, 10)[0]?.end_at, start + 300000);
    const runtime = new TrackingRuntime(store);
    runtime.accept(sample(0, { ...project, timestamp: Date.now() }));
    assert.equal(runtime.status().assistant?.resource_id, 'chatgpt:project:' + id);
    runtime.setPaused(true);
    assert.equal(runtime.status().assistant, null);
  });
});
