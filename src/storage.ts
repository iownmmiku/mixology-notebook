import type { ApiSettings, Recipe } from './types';

const RECIPES_KEY = 'mixology-custom-recipes-v1';
const PANTRY_KEY = 'mixology-pantry-v1';
const API_KEY = 'mixology-api-settings-v1';

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const storage = {
  getRecipes: () => read<Recipe[]>(RECIPES_KEY, []),
  saveRecipes: (recipes: Recipe[]) => localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes)),
  getPantry: () => read<string[]>(PANTRY_KEY, []),
  savePantry: (pantry: string[]) => localStorage.setItem(PANTRY_KEY, JSON.stringify(pantry)),
  getApi: () => read<ApiSettings>(API_KEY, {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-4o-mini',
  }),
  saveApi: (settings: ApiSettings) => localStorage.setItem(API_KEY, JSON.stringify(settings)),
};
