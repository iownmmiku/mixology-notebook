import type { ApiSettings, NotebookData, Recipe } from './types';

export type SaveResult = { ok: boolean; error?: string };
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Validator<T> = (value: unknown) => value is T;
type PersonalData = { recipes: Recipe[]; pantry: string[]; notebook: NotebookData };

export const STORAGE_KEYS = {
  recipes: 'mixology-custom-recipes-v1',
  pantry: 'mixology-pantry-v1',
  api: 'mixology-api-settings-v1',
  notebook: 'mixology-notebook-v2',
  recovery: 'mixology-recovery-v2',
  apiRecovery: 'mixology-api-recovery-v2',
} as const;

const PERSONAL_KEYS: string[] = [STORAGE_KEYS.recipes, STORAGE_KEYS.pantry, STORAGE_KEYS.notebook];
const LABELS: Record<string, string> = {
  [STORAGE_KEYS.recipes]: '个人配方', [STORAGE_KEYS.pantry]: '酒柜',
  [STORAGE_KEYS.api]: '接口设置', [STORAGE_KEYS.notebook]: '调酒记录',
};
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const emptyNotebook = (): NotebookData => ({ favorites: [], recent: [], notes: {} });
const defaultApi = (): ApiSettings => ({
  endpoint: 'https://api.openai.com/v1/chat/completions', apiKey: '', model: 'gpt-4o-mini',
});

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function keys(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  return required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
}
function str(value: unknown, max = 500, allowEmpty = false): value is string {
  return typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
}
function stringList(value: unknown, max = 10000, itemMax = 500): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every((item) => str(item, itemMax));
}
function uniqueStringList(value: unknown, max = 10000): value is string[] {
  return stringList(value, max) && new Set(value).size === value.length;
}
function date(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}
function isIngredient(value: unknown) {
  return record(value) && keys(value, ['name', 'amount', 'unit'], ['optional'])
    && str(value.name) && str(value.unit, 100, true) && typeof value.amount === 'number'
    && Number.isFinite(value.amount) && value.amount >= 0 && value.amount <= 100000
    && (value.optional === undefined || typeof value.optional === 'boolean');
}
export function isRecipe(value: unknown): value is Recipe {
  if (!record(value) || !keys(value,
    ['id', 'name', 'englishName', 'era', 'base', 'profile', 'description', 'ingredients', 'steps', 'glass', 'method', 'garnish', 'strength', 'color'],
    ['isCustom', 'sourceUrl', 'sourceLabel'])) return false;
  return str(value.id) && str(value.name) && str(value.englishName, 500, true)
    && ['经典', '现代', '无酒精', '特调'].includes(value.era as string) && str(value.base, 500, true)
    && stringList(value.profile, 40) && str(value.description, 20000, true)
    && Array.isArray(value.ingredients) && value.ingredients.length > 0 && value.ingredients.length <= 100
    && value.ingredients.every(isIngredient) && stringList(value.steps, 100, 20000)
    && str(value.glass, 500, true) && str(value.method, 500, true) && str(value.garnish, 500, true)
    && [0, 1, 2, 3].includes(value.strength as number) && str(value.color, 100)
    && (value.isCustom === undefined || typeof value.isCustom === 'boolean')
    && (value.sourceLabel === undefined || str(value.sourceLabel, 500, true))
    && (value.sourceUrl === undefined || (str(value.sourceUrl, 2000) && /^https?:\/\//.test(value.sourceUrl)));
}
function isRecipes(value: unknown): value is Recipe[] {
  return Array.isArray(value) && value.length <= 10000 && value.every(isRecipe)
    && new Set(value.map((recipe) => recipe.id)).size === value.length;
}
function isApi(value: unknown): value is ApiSettings {
  return record(value) && keys(value, ['endpoint', 'apiKey', 'model'], ['lastTest'])
    && str(value.endpoint, 2000, true) && str(value.apiKey, 10000, true) && str(value.model, 500, true)
    && (value.lastTest === undefined || (record(value.lastTest)
      && keys(value.lastTest, ['ok', 'detail', 'testedAt']) && typeof value.lastTest.ok === 'boolean'
      && str(value.lastTest.detail, 2000, true) && date(value.lastTest.testedAt)));
}
export function isNotebook(value: unknown): value is NotebookData {
  return record(value) && keys(value, ['favorites', 'recent', 'notes'])
    && uniqueStringList(value.favorites) && Array.isArray(value.recent) && value.recent.length <= 10000
    && value.recent.every((item) => record(item) && keys(item, ['recipeId', 'date']) && str(item.recipeId) && date(item.date))
    && record(value.notes) && Object.keys(value.notes).length <= 10000
    && Object.entries(value.notes).every(([id, note]) => str(id) && !['__proto__', 'constructor', 'prototype'].includes(id)
      && record(note) && keys(note, ['rating', 'text']) && typeof note.rating === 'number'
      && Number.isInteger(note.rating) && note.rating >= 0 && note.rating <= 5 && str(note.text, 20000, true));
}
function decode<T>(raw: string, validate: Validator<T>): T {
  if (raw.length > MAX_FILE_SIZE) throw new Error('数据超过大小限制');
  const parsed: unknown = JSON.parse(raw);
  const data = record(parsed) && Object.hasOwn(parsed, 'version')
    ? (keys(parsed, ['version', 'data']) && parsed.version === 2 ? parsed.data : undefined)
    : parsed; // Keep the original v1 arrays/settings readable.
  if (!validate(data)) throw new Error('数据结构不正确或版本不受支持');
  return data;
}
function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** API credentials stay in this device's localStorage and never enter exported backups. */
export function createStorage(provided?: StorageLike) {
  const problems = new Map<string, string>();
  const blocked = new Set<string>();
  const backend = () => provided ?? localStorage;

  function read<T>(key: string, validate: Validator<T>, fallback: () => T): T {
    try {
      const raw = backend().getItem(key);
      if (raw === null) { problems.delete(key); blocked.delete(key); return fallback(); }
      const data = decode(raw, validate);
      problems.delete(key); blocked.delete(key);
      return data;
    } catch (error) {
      blocked.add(key);
      problems.set(key, `${LABELS[key]}读取失败，原始数据已保留；请导入有效备份恢复。${message(error)}`);
      return fallback();
    }
  }
  function snapshot() {
    return { version: 2, savedAt: new Date().toISOString(), raw: Object.fromEntries(
      PERSONAL_KEYS.map((key) => [key, backend().getItem(key)]),
    ) };
  }
  function save<T>(key: string, data: T, validate: Validator<T>, fallback: () => T): SaveResult {
    if (!validate(data)) return { ok: false, error: `${LABELS[key]}格式不正确，未保存。` };
    read(key, validate, fallback);
    if (blocked.has(key) && key !== STORAGE_KEYS.api) return { ok: false, error: problems.get(key) };
    try {
      const previous = backend().getItem(key);
      if (blocked.has(key) && key === STORAGE_KEYS.api) {
        // Saving settings is an explicit user action. Isolate a damaged secret
        // entry on this device before replacing it; never include it in exports.
        backend().setItem(STORAGE_KEYS.apiRecovery, JSON.stringify({ version: 2, savedAt: new Date().toISOString(), raw: previous }));
      } else if (previous !== null && JSON.stringify(decode(previous, validate)) === JSON.stringify(data)) {
        problems.delete(`${key}:save`);
        return { ok: true };
      }
      if (PERSONAL_KEYS.includes(key)) backend().setItem(STORAGE_KEYS.recovery, JSON.stringify(snapshot()));
      backend().setItem(key, JSON.stringify({ version: 2, data }));
      blocked.delete(key); problems.delete(key); problems.delete(`${key}:save`);
      return { ok: true };
    } catch (error) {
      const detail = `${LABELS[key]}保存失败：${message(error)}。请检查设备存储空间与浏览器权限。`;
      problems.set(`${key}:save`, detail);
      return { ok: false, error: detail };
    }
  }
  function applyRaw(raw: Record<string, string | null>): SaveResult {
    const original: Record<string, string | null> = {};
    let startedWriting = false;
    try {
      for (const key of PERSONAL_KEYS) original[key] = backend().getItem(key);
      // Save all previous entries before touching any of the user's data.
      backend().setItem(STORAGE_KEYS.recovery, JSON.stringify({ version: 2, savedAt: new Date().toISOString(), raw: original }));
      startedWriting = true;
      for (const key of PERSONAL_KEYS) {
        if (raw[key] === null) backend().removeItem(key);
        else backend().setItem(key, raw[key]);
      }
      for (const key of PERSONAL_KEYS) { blocked.delete(key); problems.delete(key); problems.delete(`${key}:save`); }
      return { ok: true };
    } catch (error) {
      if (!startedWriting) return { ok: false, error: `导入/恢复失败：${message(error)}。未更改本机数据。` };
      let rollbackFailed = false;
      for (const key of Object.keys(original)) {
        try {
          if (original[key] === null) backend().removeItem(key);
          else backend().setItem(key, original[key]);
        } catch { rollbackFailed = true; }
      }
      return { ok: false, error: `导入/恢复失败：${message(error)}。${rollbackFailed ? '部分回滚失败，旧数据快照已保留，请释放存储空间后再次恢复。' : '原有数据已恢复。'}` };
    }
  }
  function recovery() {
    const raw = backend().getItem(STORAGE_KEYS.recovery);
    if (!raw || raw.length > MAX_FILE_SIZE) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!record(parsed) || !keys(parsed, ['version', 'savedAt', 'raw']) || parsed.version !== 2
      || !date(parsed.savedAt) || !record(parsed.raw) || !keys(parsed.raw, PERSONAL_KEYS)
      || !PERSONAL_KEYS.every((key) => parsed.raw && record(parsed.raw)
        && (parsed.raw[key] === null || typeof parsed.raw[key] === 'string'))) return null;
    return parsed.raw as Record<string, string | null>;
  }

  return {
    getRecipes: () => read(STORAGE_KEYS.recipes, isRecipes, () => []),
    getPantry: () => read(STORAGE_KEYS.pantry, uniqueStringList, () => []),
    getApi: () => read(STORAGE_KEYS.api, isApi, defaultApi),
    getNotebook: () => read(STORAGE_KEYS.notebook, isNotebook, emptyNotebook),
    saveRecipes: (recipes: Recipe[]) => save(STORAGE_KEYS.recipes, recipes, isRecipes, () => []),
    savePantry: (pantry: string[]) => save(STORAGE_KEYS.pantry, pantry, uniqueStringList, () => []),
    saveApi: (settings: ApiSettings) => save(STORAGE_KEYS.api, settings, isApi, defaultApi),
    saveNotebook: (notebook: NotebookData) => save(STORAGE_KEYS.notebook, notebook, isNotebook, emptyNotebook),
    getIssues: () => [...problems.values()],
    exportBackup(): string {
      const data: PersonalData = {
        recipes: read(STORAGE_KEYS.recipes, isRecipes, () => []),
        pantry: read(STORAGE_KEYS.pantry, uniqueStringList, () => []),
        notebook: read(STORAGE_KEYS.notebook, isNotebook, emptyNotebook),
      };
      if (PERSONAL_KEYS.some((key) => blocked.has(key))) throw new Error('存在无法读取的数据，已保留原始内容。请先恢复有效备份，再导出。');
      return JSON.stringify({ app: 'mixology-notebook', version: 2, createdAt: new Date().toISOString(), data }, null, 2);
    },
    importBackup(text: string): SaveResult {
      let data: PersonalData;
      try {
        if (text.length > MAX_FILE_SIZE) throw new Error('备份文件不能超过 5 MB');
        const parsed: unknown = JSON.parse(text);
        if (!record(parsed) || !keys(parsed, ['app', 'version', 'createdAt', 'data'])
          || parsed.app !== 'mixology-notebook' || parsed.version !== 2 || !date(parsed.createdAt)
          || !record(parsed.data) || !keys(parsed.data, ['recipes', 'pantry', 'notebook'])
          || !isRecipes(parsed.data.recipes) || !uniqueStringList(parsed.data.pantry) || !isNotebook(parsed.data.notebook)) {
          throw new Error('备份格式不正确、数据不完整或版本不受支持');
        }
        data = parsed.data as PersonalData;
      } catch (error) { return { ok: false, error: `${message(error)}。未更改本机数据。` }; }
      return applyRaw({
        [STORAGE_KEYS.recipes]: JSON.stringify({ version: 2, data: data.recipes }),
        [STORAGE_KEYS.pantry]: JSON.stringify({ version: 2, data: data.pantry }),
        [STORAGE_KEYS.notebook]: JSON.stringify({ version: 2, data: data.notebook }),
      });
    },
    getRecoveryAvailable(): boolean { try { return recovery() !== null; } catch { return false; } },
    recoverBackup(): SaveResult {
      try {
        const raw = recovery();
        return raw ? applyRaw(raw) : { ok: false, error: '没有可恢复的本机快照。' };
      } catch (error) { return { ok: false, error: `读取恢复快照失败：${message(error)}` }; }
    },
  };
}

export const storage = createStorage();
