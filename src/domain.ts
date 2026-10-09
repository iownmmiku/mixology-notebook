import type { Recipe } from './types';

/** Aliases describe the same ingredient; distinct liqueurs intentionally stay distinct. */
const aliasGroups: Record<string, string[]> = {
  '金酒': ['琴酒', '杜松子酒', 'gin'],
  '伦敦干金酒': ['伦敦干琴酒', 'london dry gin'],
  '老汤姆金酒': ['老汤姆琴酒', 'old tom gin'],
  '伏特加': ['vodka'],
  '威士忌': ['whisky', 'whiskey'],
  '波本威士忌': ['波本', 'bourbon', 'bourbon whiskey'],
  '黑麦威士忌': ['黑麦', 'rye whiskey', 'rye whisky'],
  '苏格兰威士忌': ['scotch', 'scotch whisky'],
  '爱尔兰威士忌': ['irish whiskey'],
  '朗姆酒': ['朗姆', 'rum'],
  '白朗姆酒': ['白朗姆', 'white rum', 'light rum'],
  '金色朗姆酒': ['金朗姆酒', '金朗姆', 'gold rum'],
  '深色朗姆酒': ['黑朗姆酒', '黑朗姆', 'dark rum'],
  '陈年朗姆酒': ['陈年朗姆', 'aged rum'],
  '白兰地': ['brandy'],
  '干邑': ['干邑白兰地', 'cognac'],
  '苹果白兰地': ['calvados'],
  '龙舌兰': ['龙舌兰酒', 'tequila'],
  '银龙舌兰': ['银龙舌兰酒', '白龙舌兰', 'blanco tequila', 'silver tequila'],
  '麦斯卡': ['梅斯卡尔', 'mezcal'],
  '青柠汁': ['鲜榨青柠汁', '新鲜青柠汁', '鲜榨酸橙汁', '酸橙汁', 'lime juice'],
  '柠檬汁': ['鲜榨柠檬汁', '新鲜柠檬汁', 'lemon juice'],
  '菠萝汁': ['鲜榨菠萝汁', '凤梨汁', '鲜榨凤梨汁', 'pineapple juice'],
  '橙汁': ['鲜榨橙汁', 'orange juice'],
  '西柚汁': ['葡萄柚汁', '鲜榨西柚汁', 'grapefruit juice'],
  '苏打水': ['气泡水', '苏打', 'soda water', 'club soda', 'sparkling water'],
  '汤力水': ['通宁水', 'tonic water'],
  '姜汁啤酒': ['无酒精姜汁啤酒（汽水）', '无酒精姜汁啤酒', 'alcohol-free ginger beer', 'ginger beer'],
  '糖浆': ['简单糖浆', '原味糖浆', 'simple syrup', 'sugar syrup'],
  '石榴糖浆': ['红石榴糖浆', 'grenadine', 'grenadine syrup'],
  '姜糖浆': ['ginger syrup'],
  '蜂蜜糖浆': ['honey syrup'],
  '甜味美思': ['甜味美丝', '红味美思', 'sweet vermouth'],
  '干味美思': ['干味美丝', 'dry vermouth'],
  '君度橙酒': ['君度', 'cointreau'],
  '金巴利': ['campari'],
  '阿佩罗': ['aperol'],
  '本笃会': ['本笃会利口酒', 'dom benedictine', 'benedictine'],
  '玛拉斯奇诺利口酒': ['maraschino', 'maraschino liqueur'],
  '绿色查特酒': ['绿查特酒', 'green chartreuse'],
  '黄查特酒': ['黄色查特酒', 'yellow chartreuse'],
  '圣日耳曼': ['接骨木花利口酒', 'st germain'],
  '费尔南布兰卡苦酒': ['fernet branca', 'fernet-branca'],
  '安格仕苦精': ['安格斯特拉苦精', 'angostura bitters'],
  '佩肖苦精': ['peychauds bitters', "peychaud's bitters"],
  '薄荷叶': ['新鲜薄荷叶', '薄荷', 'mint'],
  '罗勒叶': ['罗勒', 'basil'],
  '覆盆子': ['树莓', 'raspberry'],
  '覆盆子糖浆': ['树莓糖浆'],
  '覆盆子利口酒': ['树莓利口酒'],
  '淡奶油': ['鲜奶油', 'cream'],
  '蛋清': ['巴氏杀菌蛋清', 'egg white', 'pasteurized egg white'],
  'Applejack苹果白兰地': ['applejack', 'applejack 苹果白兰地'],
  'Reposado龙舌兰': ['reposado tequila', '陈酿龙舌兰'],
};

const keyFor = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/[\s·._'’\-]+/g, '');
const aliases = new Map<string, string>();
for (const [canonical, names] of Object.entries(aliasGroups)) {
  for (const name of [canonical, ...names]) aliases.set(keyFor(name), canonical);
}

export function normalizeIngredient(name: string): string {
  const key = keyFor(name);
  return aliases.get(key) ?? key;
}

// Matching is directional: a specific whisky can satisfy "whisky", but an
// unspecified whisky cannot satisfy a recipe that specifically asks for bourbon.
const parents: Record<string, string[]> = {
  '波本威士忌': ['威士忌'], '黑麦威士忌': ['威士忌'], '苏格兰威士忌': ['威士忌'],
  '爱尔兰威士忌': ['威士忌'], '日本威士忌': ['威士忌'], '加拿大威士忌': ['威士忌'],
  '伦敦干金酒': ['金酒'], '老汤姆金酒': ['金酒'],
  '白朗姆酒': ['朗姆酒'], '金色朗姆酒': ['朗姆酒'], '深色朗姆酒': ['朗姆酒'],
  '陈年朗姆酒': ['朗姆酒'], '牙买加朗姆酒': ['朗姆酒'], '151朗姆酒': ['朗姆酒'],
  '干邑': ['白兰地'], '苹果白兰地': ['白兰地'],
  '银龙舌兰': ['龙舌兰'], '陈年龙舌兰': ['龙舌兰'], '金龙舌兰': ['龙舌兰'],
  '加拿大黑麦威士忌': ['黑麦威士忌', '加拿大威士忌', '威士忌'],
  'Applejack苹果白兰地': ['苹果白兰地', '白兰地'],
  '菲诺雪莉酒': ['雪莉酒'], '阿蒙提亚多雪莉酒': ['雪莉酒'],
  'Reposado龙舌兰': ['龙舌兰'],
  '高酒度金酒': ['金酒'],
  '农业朗姆酒': ['朗姆酒'], '圭亚那朗姆酒': ['朗姆酒'],
  '高酒度牙买加朗姆酒': ['牙买加朗姆酒', '朗姆酒'],
};

function satisfies(available: string, required: string): boolean {
  return available === required || (parents[available] ?? []).includes(required);
}

function requiredIngredients(recipe: Recipe): string[] {
  const seen = new Set<string>();
  return recipe.ingredients.filter(item => !item.optional).map(item => item.name).filter(name => {
    const key = normalizeIngredient(name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function missingFor(recipe: Recipe, pantry: string[]): string[] {
  const available = [...new Set(pantry.map(normalizeIngredient))];
  return requiredIngredients(recipe).filter(name => !available.some(item => satisfies(item, normalizeIngredient(name))));
}

export function pantryMatches(recipes: Recipe[], pantry: string[]): { recipe: Recipe; missing: string[]; matched: number }[] {
  return recipes.map((recipe, order) => {
    const missing = missingFor(recipe, pantry);
    return { recipe, missing, matched: requiredIngredients(recipe).length - missing.length, order };
  }).sort((a, b) => a.missing.length - b.missing.length || b.matched - a.matched || a.order - b.order)
    .map(({ recipe, missing, matched }) => ({ recipe, missing, matched }));
}

export function shoppingSuggestions(recipes: Recipe[], pantry: string[]): { ingredient: string; unlocks: number }[] {
  const uniqueRecipes = [...new Map(recipes.map(recipe => [recipe.id, recipe])).values()];
  const incomplete = uniqueRecipes.map(recipe => ({ missing: missingFor(recipe, pantry) })).filter(item => item.missing.length > 0);
  const candidates = new Map<string, string>();
  for (const { missing } of incomplete) {
    for (const name of missing) candidates.set(normalizeIngredient(name), name);
  }
  const missingGroups = incomplete.map(({ missing }) => missing.map(normalizeIngredient));
  return [...candidates.entries()].map(([candidate, ingredient]) => ({
    ingredient,
    unlocks: missingGroups.filter(missing => missing.every(required => satisfies(candidate, required))).length,
  })).filter(item => item.unlocks > 0).sort((a, b) => b.unlocks - a.unlocks || a.ingredient.localeCompare(b.ingredient, 'zh-CN'));
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function containsTerm(text: string, term: string): boolean {
  if (!term) return false;
  const normalizedText = text.normalize('NFKC').toLowerCase();
  const normalizedTerm = term.normalize('NFKC').toLowerCase();
  return /[a-z]/i.test(normalizedTerm)
    ? new RegExp(`(^|[^a-z])${escapeRegExp(normalizedTerm)}([^a-z]|$)`, 'i').test(normalizedText)
    : normalizedText.includes(normalizedTerm);
}

type RequestConstraints = { alcoholFree: boolean; exclusions: string[]; positiveText: string; pantryOnly: boolean };

const fruitTerms = ['柠檬', '青柠', '菠萝', '橙', '西柚', '苹果', '草莓', '芒果', '百香果', '覆盆子', '香蕉', '黄瓜', '石榴', '葡萄', '蔓越莓', '蓝莓', '黑莓', '樱桃', '荔枝'];
const foodTerms = [...fruitTerms, '咖啡', '杏仁', '豆蔻', '芫荽', '橙花', '玫瑰', '洛神', '月桂', '鼠尾草', '八角', '蜂蜜'];

function constraintsFor(question: string, recipes: Recipe[]): RequestConstraints {
  const text = question.normalize('NFKC').toLowerCase().replace(/(?:对)?([^,，。;；!?！？]+?)过敏/g, '排除$1');
  const negative = /(?:不想要|不想喝|不能喝|不喜欢|不要|不加|不含|不放|不用|不喝|避开|排除|去掉|without\s+|avoid\s+|exclude\s+|allergic\s+to\s+|no\s+)([^,，。;；!?！？]+?)(?=$|[,，。;；!?！？]|但|不过|而是)/g;
  const exclusions = new Set<string>();
  const terms = [
    ...recipes.flatMap(recipe => recipe.ingredients.map(item => item.name)),
    ...Object.entries(aliasGroups).flatMap(([canonical, names]) => [canonical, ...names]),
    ...Object.keys(parents), ...Object.values(parents).flat(), '乳制品', '奶', '蛋', '糖', '利口酒', '椰子', '柑橘', ...foodTerms,
  ];
  const distinctTerms = [...new Set(terms)].sort((a, b) => b.length - a.length);
  let positiveText = text;
  for (const match of text.matchAll(negative)) {
    let clause = match[1];
    for (const term of distinctTerms) {
      if (containsTerm(clause, term)) {
        exclusions.add(normalizeIngredient(term));
        // Remove the longest match before checking shorter category/alias names.
        clause = clause.replace(new RegExp(escapeRegExp(term), 'gi'), ' ');
      }
    }
    positiveText = positiveText.replace(match[0], ' ');
  }
  const alcoholFree = /无酒精|不含酒精|不加酒精|不要(?:含)?酒精|零酒精|不喝酒|不想喝酒|不能喝酒|不饮酒|non[ -]?alcoholic|alcohol[ -]?free|mocktail|zero[ -]?proof|0\s*%/.test(text)
    && !/不要无酒精|不想(?:要|喝)无酒精/.test(text);
  return {
    alcoholFree,
    exclusions: [...exclusions],
    positiveText,
    pantryOnly: /(?:只用|只使用|仅用)(?:我(?:的)?|当前|现在)?(?:现有|已有|酒柜|手头)|只推荐能(?:做|调)|现在能(?:做|调)|用现有(?:材料|原料)|(?:现有|已有|手头)(?:材料|原料).*能(?:做|调)|酒柜(?:里|中)?.*(?:能|可以)(?:做|调)|only.*(?:pantry|available ingredients)/.test(text),
  };
}

function excludedIngredient(name: string, excluded: string): boolean {
  const ingredient = normalizeIngredient(name);
  if (satisfies(ingredient, excluded)) return true;
  if (excluded === '金酒' && (/金酒|琴酒|杜松子酒/.test(ingredient) || containsTerm(name, 'gin'))) return true;
  if (excluded === '伏特加' && (/伏特加/.test(ingredient) || containsTerm(name, 'vodka'))) return true;
  if (excluded === '威士忌' && (/威士忌/.test(ingredient) || containsTerm(name, 'whiskey') || containsTerm(name, 'whisky'))) return true;
  if (excluded === '朗姆酒' && (/朗姆/.test(ingredient) || containsTerm(name, 'rum'))) return true;
  if (excluded === '白兰地' && (/白兰地|干邑/.test(ingredient) || containsTerm(name, 'brandy') || containsTerm(name, 'cognac'))) return true;
  if (excluded === '柑橘') return /橙|柠檬|青柠|西柚|柚子|库拉索/.test(ingredient);
  if (excluded === '椰子') return /椰/.test(ingredient);
  if (foodTerms.includes(excluded)) return ingredient.includes(excluded);
  if (excluded === '乳制品') return /牛奶|奶油|乳酪|奶酪|酸奶/.test(ingredient) && !/椰子|植物|燕麦|杏仁/.test(ingredient);
  if (excluded === '奶') return /牛奶|奶油|乳酪|奶酪|酸奶/.test(ingredient);
  if (excluded === '蛋') return ingredient === '蛋清' || ingredient === '蛋黄' || ingredient === '鸡蛋';
  if (excluded === '糖') return /糖|蜂蜜/.test(ingredient);
  if (excluded === '利口酒') return /利口酒|查特酒|本笃会|圣日耳曼|君度橙酒|加利亚诺|金巴利|阿佩罗|阿玛罗|苦酒/.test(ingredient);
  return false;
}

const alcoholIngredientNames = new Set([
  '金酒', '伏特加', '威士忌', '朗姆酒', '白兰地', '干邑', '龙舌兰', '麦斯卡', '皮斯科', '卡莎萨',
  '君度橙酒', '金巴利', '阿佩罗', '本笃会', '绿色查特酒', '黄查特酒', '圣日耳曼', '加利亚诺',
  '阿玛罗', '香槟', '苦艾酒', '安格仕苦精', '佩肖苦精', '橙味苦精',
]);

/** Recognized alcohol ingredients also protect incorrectly labelled personal recipes. */
export function isAlcoholicIngredient(name: string): boolean {
  if (/无酒精|零酒精|non[ -]?alcoholic|alcohol[ -]?free|0(?:\.0)?\s*%/i.test(name)) return false;
  const ingredient = normalizeIngredient(name);
  if (ingredient === '姜汁啤酒') return false; // The mixer in this recipe collection.
  if (alcoholIngredientNames.has(ingredient)) return true;
  if ((parents[ingredient] ?? []).some(parent => alcoholIngredientNames.has(parent))) return true;
  if (Object.entries(aliasGroups).some(([canonical, names]) =>
    (alcoholIngredientNames.has(canonical) || (parents[canonical] ?? []).some(parent => alcoholIngredientNames.has(parent)))
    && names.some(alias => /[a-z]/i.test(alias) && containsTerm(name, alias)))) return true;
  return /金酒|伏特加|威士忌|朗姆|白兰地|龙舌兰酒|麦斯卡|利口酒|味美思|葡萄酒|起泡酒|波特酒|雪莉酒|查特酒|苦酒|苦精|啤酒|酒精/.test(ingredient);
}

function matchesConstraints(recipe: Recipe, constraints: RequestConstraints, pantry: string[]): boolean {
  if (constraints.alcoholFree && (recipe.strength !== 0 || recipe.ingredients.some(item => isAlcoholicIngredient(item.name)))) return false;
  if (constraints.exclusions.some(excluded => recipe.ingredients.some(item => excludedIngredient(item.name, excluded)))) return false;
  return !constraints.pantryOnly || missingFor(recipe, pantry).length === 0;
}

const tasteGroups: [RegExp, RegExp][] = [
  [/酸甜|sweet.*sour|sour.*sweet/, /酸甜|酸爽/],
  [/酸|sour|tart/, /酸|柠檬|青柠/],
  [/甜|sweet/, /甜|蜂蜜|糖|巧克力/],
  [/清爽|清新|refreshing|fresh/, /清爽|清新|清冽|干爽|气泡/],
  [/苦|bitter/, /苦|草本/],
  [/气泡|汽泡|sparkling|fizz/, /气泡/],
  [/果香|水果|fruit/, /果|莓|桃|苹果|菠萝|柑橘|樱桃|西柚/],
  [/奶香|奶油|creamy/, /奶|柔滑|绵密/],
  [/咖啡|coffee/, /咖啡/],
  [/烟熏|smoky/, /烟熏/],
  [/花香|floral/, /花香|接骨木/],
  [/草本|herbal/, /草本|草药|杜松|薄荷|罗勒/],
];

function relevanceScore(recipe: Recipe, question: string, pantry: string[]): number {
  let score = 0;
  if (containsTerm(question, recipe.name) || containsTerm(question, recipe.englishName)) score += 100;
  if (containsTerm(question, recipe.base) && recipe.base !== '无酒精') score += 12;
  const profile = [...recipe.profile, recipe.description].join(' ');
  for (const [request, taste] of tasteGroups) if (request.test(question) && taste.test(profile)) score += 6;
  for (const [canonical, aliasesForIngredient] of Object.entries(aliasGroups)) {
    if ([canonical, ...aliasesForIngredient].some(term => containsTerm(question, term))
      && recipe.ingredients.some(item => satisfies(normalizeIngredient(item.name), canonical))) score += 10;
  }
  for (const ingredient of recipe.ingredients) if (containsTerm(question, ingredient.name)) score += 5;
  if (/低度|低酒精|轻盈|light|low[ -]alcohol/.test(question)) score += (3 - recipe.strength) * 5;
  if (/高度|烈|strong|boozy/.test(question)) score += recipe.strength * 5;
  if (/简单|容易|新手|easy|simple/.test(question)) score += Math.max(0, 7 - requiredIngredients(recipe).length) * 3;
  if (pantry.length > 0) {
    const missing = missingFor(recipe, pantry).length;
    const total = requiredIngredients(recipe).length;
    score += missing === 0 ? 18 : (total - missing) / Math.max(1, total) * 8 - missing;
  }
  return score;
}

export function recommendRecipes(question: string, recipes: Recipe[], pantry: string[], limit = 4): Recipe[] {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  const constraints = constraintsFor(question, recipes);
  return recipes.filter(recipe => matchesConstraints(recipe, constraints, pantry))
    .map((recipe, order) => ({ recipe, order, score: relevanceScore(recipe, constraints.positiveText, pantry) }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, Math.floor(limit)).map(item => item.recipe);
}

/** Keep complete recipe records within a character budget, including actual steps. */
export function selectRecipeContext(question: string, recipes: Recipe[], pantry: string[], maxChars = 6000): string {
  const budget = Math.max(0, Math.floor(maxChars));
  if (!Number.isFinite(budget) || budget === 0) return '';
  const selected = recommendRecipes(question, recipes, pantry, 24);
  const context: { pantry: string[]; recipes: unknown[]; note?: string } = {
    pantry: [...new Set(pantry)].slice(0, 50).map(name => name.slice(0, 80)), recipes: [],
  };
  if (JSON.stringify(context).length > budget) context.pantry = [];
  for (const recipe of selected) {
    const entry = {
      id: recipe.id, name: recipe.name, englishName: recipe.englishName, base: recipe.base,
      profile: recipe.profile, strength: recipe.strength,
      ingredients: recipe.ingredients, steps: recipe.steps,
      method: recipe.method, glass: recipe.glass, garnish: recipe.garnish,
      missing: missingFor(recipe, pantry), sourceLabel: recipe.sourceLabel, sourceUrl: recipe.sourceUrl,
    };
    const next = { ...context, recipes: [...context.recipes, entry] };
    if (JSON.stringify(next).length <= budget) context.recipes.push(entry);
  }
  if (context.recipes.length === 0) {
    context.note = selected.length === 0 ? '配方库中没有满足本次条件的配方。请说明缺少的条件，不要忽略用户的排除项。' : '上下文空间不足以提供完整配方。';
  }
  const result = JSON.stringify(context);
  return result.length <= budget ? result : '{}'.slice(0, budget);
}
