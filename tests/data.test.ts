import test from 'node:test';
import assert from 'node:assert/strict';
import { builtInRecipes } from '../src/data/recipes';
import { isAlcoholicIngredient } from '../src/domain';

const byId = (id: string) => builtInRecipes.find(recipe => recipe.id === id)!;

test('all 271 built-in recipes retain unique ids and usable ingredients and steps', () => {
  assert.equal(builtInRecipes.length, 271);
  assert.equal(new Set(builtInRecipes.map(recipe => recipe.id)).size, 271);
  for (const recipe of builtInRecipes) {
    assert.ok(recipe.name.trim());
    assert.ok(recipe.ingredients.length > 0);
    assert.ok(recipe.steps.length > 0);
    for (const item of recipe.ingredients) {
      assert.ok(Number.isFinite(item.amount) && item.amount > 0, `${recipe.id}: ${item.name}`);
      assert.ok(item.name.trim());
      assert.ok(item.unit.trim());
    }
  }
});

test('collected recipes have individual source links and do not duplicate existing names', () => {
  const collected = builtInRecipes.filter(recipe => recipe.id.startsWith('collected-'));
  assert.equal(collected.length, 60);
  const normalizedNames = builtInRecipes.map(recipe => recipe.englishName
    .normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  assert.equal(new Set(normalizedNames).size, builtInRecipes.length);
  for (const recipe of collected) {
    assert.ok(recipe.description.trim(), recipe.id);
    assert.ok(recipe.glass.trim(), recipe.id);
    assert.ok(recipe.method.trim(), recipe.id);
    assert.equal(new URL(recipe.sourceUrl!).protocol, 'https:', recipe.id);
    assert.match(recipe.sourceLabel!, /核对|来源|官方/, recipe.id);
  }
});

test('the twenty new mocktails contain no recognized alcoholic ingredients', () => {
  const collected = builtInRecipes.filter(recipe => recipe.id.startsWith('collected-') && recipe.era === '无酒精');
  assert.equal(collected.length, 20);
  for (const recipe of collected) {
    assert.equal(recipe.strength, 0, recipe.id);
    assert.equal(recipe.ingredients.some(item => isAlcoholicIngredient(item.name)), false, recipe.id);
  }
});

test('whole fruit quantities use mass or count instead of implicitly becoming millilitres', () => {
  const fruitNames = new Set(['西瓜', '苹果', '芒果', '草莓', '青柠', '柠檬', '黄瓜', '香蕉', '百香果', '覆盆子', '蓝莓', '黑莓', '葡萄', '樱桃', '荔枝', '猕猴桃', '克莱门汀橘', '石榴籽']);
  for (const recipe of builtInRecipes) {
    for (const item of recipe.ingredients) {
      if (fruitNames.has(item.name)) assert.notEqual(item.unit, 'ml', `${recipe.id}: ${item.name}`);
    }
  }
});

test('Hanky Panky follows the verified IBA Fernet quantity with a source link', () => {
  const recipe = byId('iba-hanky-panky');
  const fernet = recipe.ingredients.find(item => item.name === '费尔南布兰卡苦酒');
  assert.equal(fernet?.amount, 7.5);
  assert.equal(fernet?.unit, 'ml');
  assert.equal(recipe.sourceUrl, 'https://iba-world.com/iba-cocktail/hanky-panky/');
});

test('Singapore Sling follows verified IBA juice and syrup quantities without soda', () => {
  const recipe = byId('iba-singapore-sling');
  assert.equal(recipe.ingredients.find(item => item.name === '鲜榨菠萝汁')?.amount, 120);
  assert.equal(recipe.ingredients.find(item => item.name === '鲜榨青柠汁')?.amount, 15);
  assert.equal(recipe.ingredients.find(item => item.name === '石榴糖浆')?.amount, 10);
  assert.equal(recipe.ingredients.some(item => item.name === '苏打水' || item.name === '鲜榨柠檬汁'), false);
  assert.equal(recipe.ingredients.find(item => item.name === '安格仕苦精')?.unit, 'dash');
  assert.equal(recipe.sourceUrl, 'https://iba-world.com/iba-cocktail/singapore-sling/');
});

test('recipe provenance distinguishes verified official recipes from house reference versions', () => {
  assert.ok(builtInRecipes.every(recipe => recipe.sourceLabel));
  assert.match(byId('iba-alexander').sourceLabel!, /家用参考/);
  assert.match(byId('iba-hanky-panky').sourceLabel!, /已核对/);
});
