import test from 'node:test';
import assert from 'node:assert/strict';
import type { Recipe } from '../src/types';
import { builtInRecipes } from '../src/data/recipes';
import { isAlcoholicIngredient, missingFor, normalizeIngredient, pantryMatches, recommendRecipes, selectRecipeContext, shoppingSuggestions } from '../src/domain';

const recipe = (id: string): Recipe => {
  const found = builtInRecipes.find(item => item.id === id);
  assert.ok(found, `Missing fixture: ${id}`);
  return found;
};

const fixture = (id: string, ingredients: string[]): Recipe => ({
  ...recipe('highball'), id, ingredients: ingredients.map(name => ({ name, amount: 15, unit: 'ml' })),
});

test('aliases normalize fresh juice and common English names without merging distinct liqueurs', () => {
  assert.equal(normalizeIngredient(' 鲜榨青柠汁 '), normalizeIngredient('青柠汁'));
  assert.equal(normalizeIngredient('Lime Juice'), normalizeIngredient('鲜榨青柠汁'));
  assert.equal(normalizeIngredient('GIN'), normalizeIngredient('琴酒'));
  assert.notEqual(normalizeIngredient('黑樱桃利口酒'), normalizeIngredient('玛拉斯奇诺利口酒'));
  assert.notEqual(normalizeIngredient('杏仁利口酒'), normalizeIngredient('杏子利口酒'));
  assert.notEqual(normalizeIngredient('绿色查特酒'), normalizeIngredient('黄查特酒'));
});

test('specific whisky satisfies a general requirement in one direction only', () => {
  assert.deepEqual(missingFor(recipe('highball'), ['苏格兰威士忌', '气泡水']), []);
  assert.deepEqual(missingFor(recipe('highball'), ['波本', '苏打水']), []);
  assert.ok(missingFor(recipe('iba-old-fashioned'), ['威士忌', '方糖', '安格仕苦精']).includes('波本威士忌'));
  assert.ok(missingFor(recipe('iba-old-fashioned'), ['苏格兰威士忌', '方糖', '安格仕苦精']).includes('波本威士忌'));
});

test('new specialty ingredients match only their aliases or directed categories', () => {
  assert.equal(normalizeIngredient('巴氏杀菌蛋清'), normalizeIngredient('蛋清'));
  assert.equal(normalizeIngredient('无酒精姜汁啤酒（汽水）'), normalizeIngredient('姜汁啤酒'));
  assert.deepEqual(missingFor(fixture('generic-rye', ['黑麦威士忌']), ['加拿大黑麦威士忌']), []);
  assert.deepEqual(missingFor(fixture('specific-rye', ['加拿大黑麦威士忌']), ['黑麦威士忌']), ['加拿大黑麦威士忌']);
  assert.notEqual(normalizeIngredient('浓糖浆（2:1）'), normalizeIngredient('糖浆'));
  assert.notEqual(normalizeIngredient('加糖椰子奶油'), normalizeIngredient('椰浆'));
  assert.notEqual(normalizeIngredient('Reposado龙舌兰'), normalizeIngredient('陈年龙舌兰'));
});

test('new fruit and egg exclusions apply while coconut cream stays distinct from dairy', () => {
  assert.deepEqual(recommendRecipes('不加蛋', [recipe('collected-pink-lady')], []), []);
  assert.deepEqual(recommendRecipes('不要蔓越莓', [recipe('collected-cranberry-mule-mocktail')], []), []);
  assert.deepEqual(recommendRecipes('不要蓝莓', [recipe('collected-blueberry-tea-mocktail')], []), []);
  assert.deepEqual(recommendRecipes('不要橙', [recipe('collected-negroni-mocktail')], []), []);
  assert.deepEqual(recommendRecipes('不要杏仁', [recipe('collected-saturn')], []), []);
  const selected = recommendRecipes('不要乳制品', [recipe('collected-pina-verde'), recipe('iba-alexander')], []);
  assert.deepEqual(selected.map(item => item.id), ['collected-pina-verde']);
});

test('missing ingredients are unique, preserve display names and ignore optional garnish', () => {
  const drink = fixture('duplicates', ['鲜榨青柠汁', '青柠汁', '金酒']);
  drink.ingredients.push({ name: '薄荷叶', amount: 1, unit: '片', optional: true });
  assert.deepEqual(missingFor(drink, ['gin']), ['鲜榨青柠汁']);
  assert.deepEqual(missingFor(drink, ['gin', 'lime juice']), []);
});

test('pantry matching sorts every result without truncating nearly available recipes', () => {
  const drinks = Array.from({ length: 15 }, (_, i) => fixture(`near-${i}`, ['金酒', `材料${i}`]));
  const ready = fixture('ready', ['金酒']);
  const matches = pantryMatches([...drinks, ready], ['金酒']);
  assert.equal(matches.length, 16);
  assert.equal(matches[0].recipe.id, 'ready');
  assert.equal(matches[0].missing.length, 0);
  assert.equal(matches.slice(1).every(item => item.missing.length === 1 && item.matched === 1), true);
});

test('a request for nonalcoholic sweet-and-sour drinks applies a hard constraint', () => {
  for (const question of ['推荐一杯无酒精酸甜的酒', '不要含酒精的，酸甜一点', 'alcohol-free refreshing mocktail']) {
    const recommendations = recommendRecipes(question, builtInRecipes, [], 20);
    assert.ok(recommendations.length > 0);
    assert.equal(recommendations.every(item => item.strength === 0 && item.base === '无酒精'), true, question);
    assert.equal(recommendations.some(item => item.id === 'iba-alexander' || item.id === 'iba-aviation'), false);
  }
});

test('personal nonalcoholic recipes can use a descriptive base while alcohol ingredients stay excluded', () => {
  const juice: Recipe = { ...fixture('custom-juice', ['橙汁', '青柠汁']), name: '我的橙柠气泡', isCustom: true, era: '无酒精', base: '果汁', strength: 0 };
  const mislabeled: Recipe = { ...juice, id: 'custom-gin', ingredients: [{ name: '琴酒', amount: 45, unit: 'ml' }] };
  const substitute: Recipe = { ...juice, id: 'custom-zero-gin', base: '无酒精金酒', ingredients: [{ name: '无酒精金酒', amount: 45, unit: 'ml' }] };
  assert.equal(recommendRecipes('推荐无酒精', [juice], [])[0].id, 'custom-juice');
  assert.equal(recommendRecipes('推荐无酒精', [mislabeled], []).length, 0);
  assert.equal(recommendRecipes('推荐无酒精', [substitute], [])[0].id, 'custom-zero-gin');
  assert.equal(isAlcoholicIngredient('琴酒'), true);
  assert.equal(isAlcoholicIngredient('A Brand Gin'), true);
  assert.equal(isAlcoholicIngredient('黑麦威士忌'), true);
  assert.equal(isAlcoholicIngredient('玛拉斯奇诺利口酒'), true);
  assert.equal(isAlcoholicIngredient('无酒精金酒'), false);
  assert.equal(isAlcoholicIngredient('姜汁啤酒'), false);
});
test('negated gin is excluded before scoring, including gin subclasses and English aliases', () => {
  for (const question of ['不要金酒，清爽一点', '不加琴酒，推荐一杯酸甜的', 'refreshing drink without gin']) {
    const recommendations = recommendRecipes(question, builtInRecipes, [], 100);
    assert.ok(recommendations.length > 0);
    assert.equal(recommendations.some(item => item.ingredients.some(ingredient => /金酒|琴酒/.test(ingredient.name))), false, question);
  }
  assert.equal(recommendRecipes('不要老汤姆金酒', [recipe('iba-casino')], []).length, 0);
  assert.equal(recommendRecipes('不要金酒', [fixture('infused-gin', ['伯爵茶浸泡金酒'])], []).length, 0);
  assert.equal(recommendRecipes('without gin', [fixture('branded-gin', ['A Brand Gin'])], []).length, 0);
});

test('multiple exclusions and optional allergen ingredients are respected', () => {
  const recommendations = recommendRecipes('不要金酒和伏特加，排除蛋和乳制品', builtInRecipes, [], 100);
  assert.ok(recommendations.length > 0);
  assert.equal(recommendations.some(item => item.ingredients.some(ingredient => /金酒|伏特加|蛋清|蛋黄|牛奶|奶油/.test(ingredient.name))), false);
  assert.equal(recommendRecipes('不加蛋清', [recipe('iba-whiskey-sour')], []).length, 0);
  assert.equal(recommendRecipes('对蛋过敏', [recipe('iba-whiskey-sour')], []).length, 0);
  assert.equal(recommendRecipes('不要柠檬', [recipe('iba-whiskey-sour')], []).length, 0);
});

test('hard pantry requests return only currently achievable recipes and can return no matches', () => {
  const results = recommendRecipes('用现有材料调一杯', builtInRecipes, ['苏格兰威士忌', '苏打水'], 20);
  assert.ok(results.some(item => item.id === 'highball'));
  assert.equal(results.every(item => missingFor(item, ['苏格兰威士忌', '苏打水']).length === 0), true);
  assert.deepEqual(recommendRecipes('只用现有材料，无酒精', [recipe('highball')], ['威士忌', '苏打水']), []);
});

test('flavor preferences rank relevant recipes and exact recipe names win', () => {
  const choices = [recipe('highball'), recipe('iba-alexander'), recipe('virgin-margarita')];
  assert.equal(recommendRecipes('无酒精酸甜清爽', choices, [])[0].id, 'virgin-margarita');
  assert.equal(recommendRecipes('亚历山大怎么做', choices, [])[0].id, 'iba-alexander');
  assert.equal(recommendRecipes('Highball', choices, [])[0].id, 'highball');
  assert.deepEqual(recommendRecipes('推荐', choices, [], 0), []);
  assert.ok(recommendRecipes('只用两种材料，简单一点', choices, []).length > 0);
});

test('ginger is not misread as the English gin alias', () => {
  assert.equal(recommendRecipes('without ginger syrup', [fixture('ginger', ['姜糖浆']), fixture('gin', ['金酒'])], [])[0].id, 'gin');
  assert.equal(recommendRecipes('without gin', [fixture('ginger', ['姜糖浆']), fixture('gin', ['金酒'])], []).length, 1);
});

test('shopping suggestions count newly unlocked recipes using aliases and directed categories', () => {
  const drinks = [fixture('a', ['金酒', '鲜榨青柠汁']), fixture('b', ['金酒', '青柠汁']), fixture('c', ['金酒', '青柠汁', '糖浆'])];
  const suggestions = shoppingSuggestions(drinks, ['琴酒']);
  assert.deepEqual(suggestions.map(item => ({ ingredient: normalizeIngredient(item.ingredient), unlocks: item.unlocks })), [{ ingredient: '青柠汁', unlocks: 2 }]);
  const whisky = shoppingSuggestions([recipe('highball'), recipe('iba-old-fashioned')], ['苏打水', '方糖', '安格仕苦精']);
  assert.equal(whisky.find(item => item.ingredient === '波本威士忌')?.unlocks, 2);
  assert.equal(whisky.find(item => item.ingredient === '威士忌')?.unlocks, 1);
  assert.deepEqual(shoppingSuggestions([fixture('both-categories', ['威士忌', '波本威士忌'])], []), [{ ingredient: '波本威士忌', unlocks: 1 }]);
});

test('already available and duplicate recipe ids do not inflate shopping totals', () => {
  const a = fixture('a', ['金酒', '柠檬汁']);
  const ready = fixture('ready', ['金酒']);
  assert.equal(shoppingSuggestions([a, a, ready], ['金酒'])[0].unlocks, 1);
  assert.deepEqual(shoppingSuggestions([ready], ['金酒']), []);
});

test('AI context stays within budget with complete quantities and steps, and respects constraints', () => {
  const result = selectRecipeContext('无酒精酸甜，不要薄荷', builtInRecipes, [], 2800);
  assert.ok(result.length <= 2800);
  const context = JSON.parse(result);
  assert.ok(context.recipes.length > 0);
  for (const entry of context.recipes) {
    const original = recipe(entry.id);
    assert.equal(original.strength, 0);
    assert.equal(original.ingredients.some(item => normalizeIngredient(item.name) === '薄荷叶'), false);
    assert.deepEqual(entry.ingredients, original.ingredients);
    assert.deepEqual(entry.steps, original.steps);
  }
  assert.equal(selectRecipeContext('推荐', builtInRecipes, [], 0), '');
  assert.ok(selectRecipeContext('推荐', builtInRecipes, [], 100).length <= 100);
});
