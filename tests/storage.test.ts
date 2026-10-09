import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStorage, STORAGE_KEYS } from '../src/storage';
import type { Recipe } from '../src/types';

class FakeStorage {
  data = new Map<string, string>();
  failOnceKey: string | null = null;
  failAllWrites = false;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failAllWrites || key === this.failOnceKey) {
      this.failOnceKey = null;
      throw new Error('QuotaExceededError');
    }
    this.data.set(key, value);
  }
  removeItem(key: string) { this.data.delete(key); }
}
const recipe: Recipe = {
  id: 'custom-1', name: '测试配方', englishName: '', era: '特调', base: '金酒',
  profile: ['清爽'], description: '', ingredients: [{ name: '金酒', amount: 30, unit: 'ml' }],
  steps: ['搅拌'], glass: '古典杯', method: '搅拌', garnish: '', strength: 2, color: '#aabbcc', isCustom: true,
};
const notebook = { favorites: ['custom-1'], recent: [{ recipeId: 'custom-1', date: '2026-10-08T12:00:00.000Z' }], notes: { 'custom-1': { rating: 4, text: '下次少一点糖' } } };
function makeBackup(pantry = ['金酒']) {
  return JSON.stringify({ app: 'mixology-notebook', version: 2, createdAt: '2026-10-08T12:00:00.000Z', data: { recipes: [recipe], pantry, notebook } });
}

test('legacy v1 values remain readable and migrate on an explicit save', () => {
  const backend = new FakeStorage();
  backend.setItem(STORAGE_KEYS.recipes, JSON.stringify([recipe]));
  backend.setItem(STORAGE_KEYS.pantry, JSON.stringify(['金酒']));
  backend.setItem(STORAGE_KEYS.api, JSON.stringify({ endpoint: 'https://example.com/v1/chat/completions', apiKey: 'secret', model: 'model' }));
  const storage = createStorage(backend);
  assert.deepEqual(storage.getRecipes(), [recipe]);
  assert.deepEqual(storage.getPantry(), ['金酒']);
  assert.equal(storage.getApi().apiKey, 'secret');
  assert.deepEqual(storage.getNotebook(), { favorites: [], recent: [], notes: {} });
  assert.equal(storage.savePantry(['金酒', '苏打水']).ok, true);
  assert.equal(JSON.parse(backend.getItem(STORAGE_KEYS.pantry)!).version, 2);
});

test('legacy editor recipes with empty steps or long instructions remain readable', () => {
  const backend = new FakeStorage();
  const legacyRecipes = [{ ...recipe, steps: [] }, { ...recipe, id: 'custom-long', steps: ['操作说明'.repeat(1000)] }];
  backend.setItem(STORAGE_KEYS.recipes, JSON.stringify(legacyRecipes));
  const storage = createStorage(backend);
  assert.deepEqual(storage.getRecipes(), legacyRecipes);
  assert.equal(storage.getIssues().length, 0);
  assert.equal(storage.saveRecipes(legacyRecipes).ok, true);
});

test('explicit API settings save can repair a damaged entry and isolates its old raw value', () => {
  const backend = new FakeStorage();
  backend.setItem(STORAGE_KEYS.api, '{old-secret-broken');
  const storage = createStorage(backend);
  assert.equal(storage.getApi().apiKey, '');
  assert.match(storage.getIssues().join(' '), /接口设置读取失败/);
  assert.equal(storage.saveApi({ endpoint: 'https://example.com/api', apiKey: 'new-key', model: 'model' }).ok, true);
  assert.equal(storage.getApi().apiKey, 'new-key');
  assert.equal(storage.getIssues().length, 0);
  assert.equal(JSON.parse(backend.getItem(STORAGE_KEYS.apiRecovery)!).raw, '{old-secret-broken');
  assert.equal(storage.exportBackup().includes('secret'), false);
  assert.equal(storage.exportBackup().includes('new-key'), false);
});

test('damaged JSON and invalid runtime schema are preserved against fallback autosaves', () => {
  for (const raw of ['{broken json', JSON.stringify([{ id: 'invalid' }]), JSON.stringify({ version: 99, data: [] })]) {
    const backend = new FakeStorage();
    backend.setItem(STORAGE_KEYS.recipes, raw);
    const storage = createStorage(backend);
    assert.deepEqual(storage.getRecipes(), []);
    assert.equal(storage.saveRecipes([]).ok, false);
    assert.equal(backend.getItem(STORAGE_KEYS.recipes), raw);
    assert.match(storage.getIssues().join(' '), /原始数据已保留/);
    assert.throws(() => storage.exportBackup(), /无法读取/);
  }
});

test('storage write failures return failure and preserve the previous value', () => {
  const backend = new FakeStorage();
  backend.setItem(STORAGE_KEYS.pantry, JSON.stringify(['金酒']));
  const storage = createStorage(backend);
  backend.failOnceKey = STORAGE_KEYS.pantry;
  assert.equal(storage.savePantry(['朗姆酒']).ok, false);
  assert.deepEqual(storage.getPantry(), ['金酒']);
  assert.match(storage.getIssues().join(' '), /保存失败/);
  assert.equal(storage.savePantry(['朗姆酒']).ok, true);
  assert.equal(storage.getIssues().length, 0);
});

test('exported backup covers all personal data but never includes API credentials', () => {
  const backend = new FakeStorage();
  const storage = createStorage(backend);
  assert.equal(storage.saveRecipes([recipe]).ok, true);
  assert.equal(storage.saveNotebook(notebook).ok, true);
  assert.equal(storage.saveApi({ endpoint: 'https://example.com/api', apiKey: 'VERY-SECRET', model: 'model' }).ok, true);
  const backup = storage.exportBackup();
  assert.equal(backup.includes('VERY-SECRET'), false);
  assert.equal(backup.includes('apiKey'), false);
  const restored = createStorage(new FakeStorage());
  assert.equal(restored.importBackup(backup).ok, true);
  assert.deepEqual(restored.getRecipes(), [recipe]);
  assert.deepEqual(restored.getNotebook(), notebook);
});

test('backup import rejects incomplete, unknown and invalid fields before any writes', () => {
  const backend = new FakeStorage();
  backend.setItem(STORAGE_KEYS.pantry, JSON.stringify(['原有原料']));
  const storage = createStorage(backend);
  const valid = JSON.parse(makeBackup());
  const cases = [
    { ...valid, version: 99 },
    { ...valid, app: 'other-app' },
    { ...valid, data: { ...valid.data, notebook: undefined } },
    { ...valid, data: { ...valid.data, apiKey: 'unwanted' } },
    { ...valid, data: { ...valid.data, recipes: [{ ...recipe, ingredients: [{ name: '金酒', amount: -1, unit: 'ml' }] }] } },
    { ...valid, data: { ...valid.data, notebook: { ...notebook, notes: { bad: { rating: 10, text: '' } } } } },
    { ...valid, data: { ...valid.data, recipes: [recipe, recipe] } },
  ];
  for (const backup of cases) {
    const before = [...backend.data];
    assert.equal(storage.importBackup(JSON.stringify(backup)).ok, false);
    assert.deepEqual([...backend.data], before);
  }
});

test('failed multi-key import rolls back values and retains the previous snapshot', () => {
  const backend = new FakeStorage();
  backend.setItem(STORAGE_KEYS.recipes, JSON.stringify([]));
  backend.setItem(STORAGE_KEYS.pantry, JSON.stringify(['原有原料']));
  const storage = createStorage(backend);
  backend.failOnceKey = STORAGE_KEYS.pantry;
  assert.equal(storage.importBackup(makeBackup()).ok, false);
  assert.deepEqual(storage.getRecipes(), []);
  assert.deepEqual(storage.getPantry(), ['原有原料']);
  assert.deepEqual(storage.getNotebook(), { favorites: [], recent: [], notes: {} });
  assert.equal(storage.getRecoveryAvailable(), true);
});

test('valid import can replace corrupt values explicitly and recover the exact prior snapshot', () => {
  const backend = new FakeStorage();
  const corrupt = '{preserve me';
  backend.setItem(STORAGE_KEYS.recipes, corrupt);
  backend.setItem(STORAGE_KEYS.pantry, JSON.stringify(['原有原料']));
  backend.setItem(STORAGE_KEYS.api, JSON.stringify({ endpoint: 'https://example.com/api', apiKey: 'existing-key', model: 'model' }));
  const storage = createStorage(backend);
  assert.equal(storage.importBackup(makeBackup()).ok, true);
  assert.deepEqual(storage.getRecipes(), [recipe]);
  assert.equal(storage.getApi().apiKey, 'existing-key');
  assert.equal(storage.getIssues().length, 0);
  assert.equal(storage.recoverBackup().ok, true);
  assert.equal(backend.getItem(STORAGE_KEYS.recipes), corrupt);
  assert.deepEqual(storage.getPantry(), ['原有原料']);
  assert.equal(storage.getApi().apiKey, 'existing-key');
});

test('a snapshot failure prevents a multi-key import from changing data', () => {
  const backend = new FakeStorage();
  backend.setItem(STORAGE_KEYS.pantry, JSON.stringify(['原有原料']));
  backend.failOnceKey = STORAGE_KEYS.recovery;
  const storage = createStorage(backend);
  assert.equal(storage.importBackup(makeBackup()).ok, false);
  assert.deepEqual(storage.getPantry(), ['原有原料']);
  assert.deepEqual(storage.getRecipes(), []);
});
