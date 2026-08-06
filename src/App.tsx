import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, Bot, Check, ChevronRight, CirclePlus, Copy, Edit3, FlaskConical,
  GlassWater, KeyRound, LoaderCircle, MessageCircle, Minus, PackageCheck, Plus, Search,
  Send, Settings, Sparkles, Trash2, UserRound, X,
} from 'lucide-react';
import { builtInRecipes, commonPantry } from './data/recipes';
import { postChatCompletion, testConnection, type TestResult } from './api';
import { storage } from './storage';
import type { ApiSettings, ChatMessage, Ingredient, Recipe } from './types';

type Tab = 'recipes' | 'pantry' | 'chat' | 'profile';
type Filter = '全部' | '经典' | '现代' | '无酒精' | '特调' | '我的';

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');
const LONG_GLASSES = ['高球杯', '柯林杯', '飓风杯', '葡萄酒杯', '香槟杯', '铜杯', '耐热杯', '朱莉普杯'];
const isLongDrink = (recipe: Recipe) => LONG_GLASSES.some((glass) => recipe.glass.includes(glass));
const requiredNames = (recipe: Recipe) => recipe.ingredients.filter((item) => !item.optional).map((item) => item.name);
const missingFor = (recipe: Recipe, pantry: string[]) => {
  const owned = new Set(pantry.map(normalize));
  return requiredNames(recipe).filter((name) => !owned.has(normalize(name)));
};

function strengthLabel(strength: Recipe['strength']) {
  return ['无酒精', '轻盈', '适中', '浓烈'][strength];
}

function App() {
  const [tab, setTab] = useState<Tab>('recipes');
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>(storage.getRecipes);
  const [pantry, setPantry] = useState<string[]>(storage.getPantry);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [editing, setEditing] = useState<Recipe | null | 'new'>(null);
  const [toast, setToast] = useState('');

  const recipes = [...customRecipes, ...builtInRecipes.filter((item) => !customRecipes.some((custom) => custom.id === item.id))];

  useEffect(() => { storage.saveRecipes(customRecipes); }, [customRecipes]);
  useEffect(() => { storage.savePantry(pantry); }, [pantry]);
  useLayoutEffect(() => {
    document.querySelectorAll<HTMLElement>('.screen').forEach((el) => { el.scrollTop = 0; });
  }, [tab]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const saveRecipe = (recipe: Recipe) => {
    setCustomRecipes((current) => [recipe, ...current.filter((item) => item.id !== recipe.id)]);
    setSelected(recipe);
    setEditing(null);
    setToast('配方已保存到本机');
  };

  const deleteRecipe = (recipe: Recipe) => {
    setCustomRecipes((current) => current.filter((item) => item.id !== recipe.id));
    setSelected(null);
    setToast(builtInRecipes.some((item) => item.id === recipe.id) ? '已恢复内置配方' : '已删除配方');
  };

  return (
    <div className="app-shell">
      <main className="main-content">
        <RecipeLibrary recipes={recipes} onSelect={setSelected} onCreate={() => setEditing('new')} active={tab === 'recipes'} />
        <Pantry recipes={recipes} pantry={pantry} setPantry={setPantry} onSelect={setSelected} active={tab === 'pantry'} />
        <Bartender recipes={recipes} pantry={pantry} active={tab === 'chat'} />
        <Profile customRecipes={customRecipes} onSelect={setSelected} onCreate={() => setEditing('new')} active={tab === 'profile'} />
      </main>

      <nav className="bottom-nav" aria-label="主导航">
        <NavItem active={tab === 'recipes'} icon={BookOpen} label="配方" onClick={() => setTab('recipes')} />
        <NavItem active={tab === 'pantry'} icon={PackageCheck} label="酒柜" onClick={() => setTab('pantry')} />
        <NavItem active={tab === 'chat'} icon={MessageCircle} label="调酒师" onClick={() => setTab('chat')} special />
        <NavItem active={tab === 'profile'} icon={UserRound} label="我的" onClick={() => setTab('profile')} />
      </nav>

      {selected && (
        <RecipeDetail
          recipe={selected}
          isSaved={customRecipes.some((item) => item.id === selected.id)}
          onClose={() => setSelected(null)}
          onEdit={() => setEditing(selected)}
          onCopy={() => setEditing({ ...selected, id: `custom-${Date.now()}`, name: `${selected.name} · 我的版本`, isCustom: true })}
          onDelete={() => deleteRecipe(selected)}
        />
      )}
      {editing && (
        <RecipeEditor
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={saveRecipe}
        />
      )}
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </div>
  );
}

function NavItem({ active, icon: Icon, label, onClick, special = false }: { active: boolean; icon: typeof BookOpen; label: string; onClick: () => void; special?: boolean }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''} ${special ? 'special' : ''}`} onClick={onClick}>
      <span className="nav-icon"><Icon size={21} strokeWidth={active ? 2.4 : 1.8} /></span>
      <span>{label}</span>
    </button>
  );
}

function RecipeLibrary({ recipes, onSelect, onCreate, active }: { recipes: Recipe[]; onSelect: (r: Recipe) => void; onCreate: () => void; active: boolean }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('全部');
  const q = normalize(query);
  const [featured] = useState<Recipe | null>(() => (recipes.length ? recipes[Math.floor(Math.random() * recipes.length)] : null));
  const filtered = recipes.filter((recipe) => {
    const inFilter = filter === '全部' || (filter === '我的' ? recipe.isCustom : recipe.era === filter);
    const haystack = [recipe.name, recipe.englishName, recipe.base, recipe.description, ...recipe.profile, ...recipe.ingredients.map((item) => item.name)].join(' ');
    return inFilter && (!q || normalize(haystack).includes(q));
  });
  return (
    <div className={`screen recipes-screen ${active ? 'active' : ''}`}>
      <header className="topbar">
        <div><span className="eyebrow">MIXOLOGY NOTEBOOK</span><h1>调酒手册</h1></div>
        <button className="icon-button" onClick={onCreate} aria-label="新建配方" title="新建配方"><CirclePlus /></button>
      </header>

      <div className="search-box">
        <Search size={19} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索酒名、基酒、口味或原料" />
        {query && <button onClick={() => setQuery('')} aria-label="清空"><X size={17} /></button>}
      </div>

      {!query && filter === '全部' && featured && (
        <button className="feature" onClick={() => onSelect(featured)}>
          <div className="feature-copy">
            <span className="feature-label"><Sparkles size={14} /> 今日推荐</span>
            <h2>{featured.name}</h2>
            <p>{featured.englishName}</p>
            <div className="profile-row">{featured.profile.map((item) => <span key={item}>{item}</span>)}</div>
          </div>
          <CocktailVisual recipe={featured} large />
        </button>
      )}

      <div className="filter-row">
        {(['全部', '经典', '现代', '无酒精', '特调', '我的'] as Filter[]).map((item) => (
          <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>
        ))}
      </div>

      <div className="section-heading">
        <h2>{query ? '搜索结果' : filter === '全部' ? '全部配方' : `${filter}配方`}</h2>
        <span>{filtered.length} 杯</span>
      </div>
      <div className="recipe-list">
        {filtered.map((recipe) => <RecipeRow key={recipe.id} recipe={recipe} onClick={() => onSelect(recipe)} />)}
      </div>
      {filtered.length === 0 && <Empty icon={Search} title="没有找到配方" text="换个酒名、口味或原料试试" />}
    </div>
  );
}

function CocktailVisual({ recipe, large = false }: { recipe: Recipe; large?: boolean }) {
  const tall = isLongDrink(recipe);
  return (
    <div className={`cocktail-visual ${tall ? 'tall' : ''} ${large ? 'large' : ''}`} style={{ '--drink': recipe.color } as React.CSSProperties} aria-hidden="true">
      <span className="glass-rim" />
      <span className="drink" />
      <span className="liquid" />
      <span className="stem" />
      <span className="foot" />
      <span className="garnish-dot" />
    </div>
  );
}

function RecipeRow({ recipe, onClick, aside }: { recipe: Recipe; onClick: () => void; aside?: React.ReactNode }) {
  return (
    <button className="recipe-row" onClick={onClick}>
      <CocktailVisual recipe={recipe} />
      <span className="recipe-row-copy">
        <span className="recipe-title-line"><strong>{recipe.name}</strong>{recipe.isCustom && <em>我的</em>}</span>
        <small>{recipe.englishName}</small>
        <span className="recipe-meta">{recipe.base} · {recipe.profile.slice(0, 2).join(' / ')}<span className="strength" title={`酒精强度：${strengthLabel(recipe.strength)}`}>{[0, 1, 2, 3].map((n) => <i key={n} className={n < recipe.strength ? 'on' : ''} />)}</span></span>
      </span>
      {aside ?? <ChevronRight size={19} className="chevron" />}
    </button>
  );
}

function Pantry({ recipes, pantry, setPantry, onSelect, active }: { recipes: Recipe[]; pantry: string[]; setPantry: (v: string[]) => void; onSelect: (r: Recipe) => void; active: boolean }) {
  const [input, setInput] = useState('');
  const ingredients = Array.from(new Set([...commonPantry, ...recipes.flatMap((r) => r.ingredients.map((item) => item.name))]));
  const suggestions = ingredients.filter((name) => !pantry.includes(name) && (!input || normalize(name).includes(normalize(input)))).slice(0, 10);
  const matches = recipes.map((recipe) => {
    const missing = missingFor(recipe, pantry);
    return { recipe, missing, matched: requiredNames(recipe).length - missing.length };
  }).sort((a, b) => a.missing.length - b.missing.length || b.matched - a.matched);
  const exact = matches.filter((item) => item.missing.length === 0);
  const close = matches.filter((item) => item.missing.length > 0 && item.missing.length <= 2).slice(0, 10);

  const add = (name: string) => {
    const value = name.trim();
    if (value && !pantry.includes(value)) setPantry([...pantry, value]);
    setInput('');
  };

  return (
    <div className={`screen pantry-screen ${active ? 'active' : ''}`}>
      <header className="topbar compact"><div><span className="eyebrow">MY BAR</span><h1>我的酒柜</h1></div><span className="count-badge">{pantry.length}</span></header>
      <p className="lead">选择现有原料，即时计算你能完成的配方。</p>
      <form className="ingredient-add" onSubmit={(event) => { event.preventDefault(); add(input); }}>
        <Search size={18} /><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="输入或搜索原料" />
        <button disabled={!input.trim()} aria-label="添加原料"><Plus size={19} /></button>
      </form>
      {input && <div className="suggestions">{suggestions.map((name) => <button key={name} onClick={() => add(name)}>{name}<Plus size={15} /></button>)}</div>}

      <div className="pantry-chips">
        {pantry.map((name) => <button key={name} onClick={() => setPantry(pantry.filter((item) => item !== name))}>{name}<X size={14} /></button>)}
      </div>
      {pantry.length === 0 && (
        <div className="quick-pantry"><span>常用原料</span><div>{commonPantry.slice(0, 12).map((name) => <button key={name} onClick={() => add(name)}><Plus size={13} />{name}</button>)}</div></div>
      )}

      <div className="match-summary">
        <div><strong>{exact.length}</strong><span>杯可以调制</span></div>
        <div><strong>{close.length}</strong><span>杯只差一两样</span></div>
      </div>

      <div className="section-heading"><h2>现在能调</h2><span>忽略可选装饰</span></div>
      <div className="recipe-list">
        {exact.map(({ recipe }) => <RecipeRow key={recipe.id} recipe={recipe} onClick={() => onSelect(recipe)} aside={<span className="ready"><Check size={15} />可调</span>} />)}
      </div>
      {exact.length === 0 && <Empty icon={FlaskConical} title="还没有完整匹配" text="继续加入原料，或看看下方还缺什么" />}

      {close.length > 0 && <><div className="section-heading"><h2>差一点就能调</h2></div><div className="recipe-list">
        {close.map(({ recipe, missing, matched }) => <RecipeRow key={recipe.id} recipe={recipe} onClick={() => onSelect(recipe)} aside={<span className="missing">已备{matched}项·缺{missing.join('、')}</span>} />)}
      </div></>}
    </div>
  );
}

function Bartender({ recipes, pantry, active }: { recipes: Recipe[]; pantry: string[]; active: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<ApiSettings>(storage.getApi);
  const [showSettings, setShowSettings] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = chatBodyRef.current;
    if (body) {
      Promise.resolve(body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' })).catch(() => {});
    }
  }, [messages, loading]);

  const localAnswer = (question: string) => {
    const q = normalize(question);
    const candidates = recipes.filter((recipe) => {
      const terms = [recipe.name, recipe.englishName, recipe.base, ...recipe.profile, ...recipe.ingredients.map((item) => item.name)];
      return terms.some((term) => q.includes(normalize(term)) || normalize(term).includes(q));
    }).slice(0, 4);
    const available = recipes.filter((recipe) => missingFor(recipe, pantry).length === 0).slice(0, 4);
    if ((q.includes('能做') || q.includes('能调') || q.includes('酒柜')) && pantry.length) {
      return available.length ? `按你的酒柜，目前可以完整调制：${available.map((item) => item.name).join('、')}。我建议先从${available[0].name}开始，它的${available[0].profile.join('、')}特征最明确。` : '目前还没有完整匹配的配方。去“酒柜”继续加入柠檬/青柠汁、糖浆等辅料，通常就能解锁一批酸酒。';
    }
    if (candidates.length) return `配方库里比较符合的是：${candidates.map((item) => `${item.name}（${item.profile.join('、')}）`).join('；')}。打开 API 后，我还能根据甜度、酒精度和现有原料进一步改配方。`;
    return '我可以按口味、基酒或现有原料推荐，也能解释技法和调整比例。当前是离线知识库模式；在右上角设置 OpenAI 兼容 API 后，可获得完整的专业对话与创意配方能力。';
  };

  const send = async (preset?: string) => {
    const content = (preset ?? input).trim();
    if (!content || loading) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    if (!settings.apiKey) {
      setMessages([...next, { role: 'assistant', content: localAnswer(content) }]);
      return;
    }
    setLoading(true);
    try {
      const context = recipes.map((r) => `${r.name}: ${r.ingredients.map((x) => `${x.name}${x.amount}${x.unit}`).join(', ')}`).join('\n');
      const answer = await postChatCompletion(settings, next, pantry, context);
      setMessages([...next, { role: 'assistant', content: answer }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      const hint = message.includes('Failed to fetch') || message.includes('网络') || message.includes('CORS')
        ? '请检查网络连接，或确认接口地址支持跨域调用（可通过自己的后端代理转发）。'
        : '请检查接口地址、模型名称和密钥是否正确。';
      setMessages([...next, { role: 'assistant', content: `连接失败：${message}。${hint}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`screen chat-screen ${active ? 'active' : ''}`}>
      <header className="topbar compact"><div><span className="eyebrow">AI BARTENDER</span><h1>专业调酒师</h1></div><button className="icon-button" onClick={() => setShowSettings(true)} aria-label="API 设置"><Settings /></button></header>
      <div className={`connection-state ${settings.apiKey ? 'online' : ''}`}><span />{settings.apiKey ? `${settings.model} 已配置` : '离线知识库模式'}</div>
      <div className="chat-body" ref={chatBodyRef}>
        {messages.length === 0 && <div className="chat-welcome">
          <div className="bot-mark"><Bot size={30} /></div><h2>今晚想喝什么？</h2><p>告诉我你的原料、偏好或想尝试的风格。</p>
          <div className="prompt-grid">
            {['用我的酒柜能做什么？', '推荐一杯酸甜清爽的酒', '如何调整内格罗尼的苦味？', '给我一个有创意的无酒精配方'].map((text) => <button key={text} onClick={() => send(text)}>{text}<ChevronRight size={15} /></button>)}
          </div>
        </div>}
        {messages.map((message, index) => <div key={index} className={`message ${message.role}`}>
          {message.role === 'assistant' && <span className="avatar"><Bot size={16} /></span>}<div>{message.content}</div>
        </div>)}
        {loading && <div className="message assistant"><span className="avatar"><Bot size={16} /></span><div className="typing"><i /><i /><i /></div></div>}
      </div>
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <textarea rows={1} value={input} onChange={(event) => setInput(event.target.value)} placeholder="问配方、风味或技法…" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} />
        <button disabled={!input.trim() || loading} aria-label="发送">{loading ? <LoaderCircle className="spin" /> : <Send />}</button>
      </form>
      {showSettings && <ApiSettingsSheet initial={settings} onClose={() => setShowSettings(false)} onSave={(value) => { setSettings(value); storage.saveApi(value); setShowSettings(false); }} />}
    </div>
  );
}

function Profile({ customRecipes, onSelect, onCreate, active }: { customRecipes: Recipe[]; onSelect: (r: Recipe) => void; onCreate: () => void; active: boolean }) {
  const api = storage.getApi();
  return (
    <div className={`screen profile-screen ${active ? 'active' : ''}`}>
      <header className="topbar compact"><div><span className="eyebrow">PERSONAL NOTEBOOK</span><h1>我的手册</h1></div></header>
      <div className="stat-strip">
        <div><strong>{customRecipes.length}</strong><span>个人配方</span></div><div><strong>{builtInRecipes.length}</strong><span>内置配方</span></div><div><strong>{api.apiKey ? '已连接' : '离线'}</strong><span>调酒师</span></div>
      </div>
      <button className="create-banner" onClick={onCreate}><span><CirclePlus /><b>建立新配方</b><small>从零记录材料、比例与调制步骤</small></span><ChevronRight /></button>
      <div className="section-heading"><h2>我的配方</h2><span>{customRecipes.length} 杯</span></div>
      <div className="recipe-list">{customRecipes.map((recipe) => <RecipeRow key={recipe.id} recipe={recipe} onClick={() => onSelect(recipe)} />)}</div>
      {customRecipes.length === 0 && <Empty icon={GlassWater} title="还没有个人配方" text="编辑内置配方或从零建立一杯" />}
      <div className="about-block"><FlaskConical /><div><strong>调酒手册 1.0</strong><p>所有配方、酒柜和 API 设置均保存在你的设备上。</p></div></div>
    </div>
  );
}

function RecipeDetail({ recipe, isSaved, onClose, onEdit, onCopy, onDelete }: { recipe: Recipe; isSaved: boolean; onClose: () => void; onEdit: () => void; onCopy: () => void; onDelete: () => void }) {
  const [scale, setScale] = useState(1);
  return (
    <div className="overlay"><article className="detail-sheet">
      <div className="detail-hero" style={{ '--accent': recipe.color } as React.CSSProperties}>
        <div className="sheet-actions"><button onClick={onClose} aria-label="返回"><ArrowLeft /></button><div><button onClick={onCopy} title="复制为个人配方"><Copy /></button><button onClick={onEdit} title="编辑配方"><Edit3 /></button></div></div>
        <div className="detail-title"><span>{recipe.era} · {recipe.base}</span><h1>{recipe.name}</h1><p>{recipe.englishName}</p></div>
        <CocktailVisual recipe={recipe} large />
      </div>
      <div className="detail-content">
        <div className="profile-row dark">{recipe.profile.map((item) => <span key={item}>{item}</span>)}<span>{strengthLabel(recipe.strength)}</span></div>
        <p className="description">{recipe.description}</p>
        <div className="facts"><div><small>杯型</small><strong>{recipe.glass}</strong></div><div><small>技法</small><strong>{recipe.method}</strong></div><div><small>装饰</small><strong>{recipe.garnish}</strong></div></div>
        <div className="strength-bar"><span>酒精强度</span><div className="strength-meter">{[0, 1, 2, 3].map((n) => <i key={n} className={n < recipe.strength ? 'on' : ''} />)}</div><b>{strengthLabel(recipe.strength)}</b></div>
        <div className="detail-section-title"><h2>所需材料</h2><div className="scale-control"><button onClick={() => setScale(Math.max(.5, scale - .5))} aria-label="减少份量"><Minus /></button><span>{scale} 杯</span><button onClick={() => setScale(Math.min(6, scale + .5))} aria-label="增加份量"><Plus /></button></div></div>
        <div className="ingredient-list">{recipe.ingredients.map((item, index) => <div key={`${item.name}-${index}`}><span>{item.name}{item.optional && <small> 可选</small>}</span><strong>{Number((item.amount * scale).toFixed(1))} {item.unit}</strong></div>)}</div>
        <div className="detail-section-title"><h2>调制方法</h2></div>
        <ol className="steps">{recipe.steps.map((step, index) => <li key={index}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
        <div className="detail-buttons"><button className="secondary" onClick={onCopy}><Copy />复制并调整</button><button className="primary" onClick={onEdit}><Edit3 />编辑配方</button></div>
        {isSaved && <button className="delete-button" onClick={onDelete}><Trash2 />{builtInRecipes.some((item) => item.id === recipe.id) ? '撤销我的修改' : '删除这份配方'}</button>}
      </div>
    </article></div>
  );
}

function RecipeEditor({ initial, onClose, onSave }: { initial?: Recipe; onClose: () => void; onSave: (r: Recipe) => void }) {
  const [recipe, setRecipe] = useState<Recipe>(initial ? { ...initial, ingredients: initial.ingredients.map((item) => ({ ...item })), steps: [...initial.steps], isCustom: true } : {
    id: `custom-${Date.now()}`, name: '', englishName: '', era: '现代', base: '', profile: [], description: '', ingredients: [iBlank()], steps: [''], glass: '', method: '摇和', garnish: '', strength: 2, color: '#c86b3c', isCustom: true,
  });
  const [profileText, setProfileText] = useState(recipe.profile.join('、'));
  const update = <K extends keyof Recipe>(key: K, value: Recipe[K]) => setRecipe((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!recipe.name.trim() || !recipe.ingredients.some((item) => item.name.trim())) return;
    onSave({ ...recipe, profile: profileText.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean), ingredients: recipe.ingredients.filter((item) => item.name.trim()), steps: recipe.steps.filter(Boolean), isCustom: true });
  };
  return (
    <div className="overlay editor-overlay"><form className="editor-sheet" onSubmit={submit}>
      <header className="editor-header"><button type="button" onClick={onClose}><X /></button><h1>{initial ? '调整配方' : '新建配方'}</h1><button className="text-save" type="submit">保存</button></header>
      <div className="editor-content">
        <Field label="中文名称" required><input value={recipe.name} onChange={(e) => update('name', e.target.value)} placeholder="例如：午夜花园" /></Field>
        <Field label="英文名称"><input value={recipe.englishName} onChange={(e) => update('englishName', e.target.value)} placeholder="可选" /></Field>
        <div className="field-grid"><Field label="分类"><select value={recipe.era} onChange={(e) => update('era', e.target.value as Recipe['era'])}><option>经典</option><option>现代</option><option>无酒精</option><option>特调</option></select></Field><Field label="基酒"><input value={recipe.base} onChange={(e) => update('base', e.target.value)} placeholder="金酒" /></Field></div>
        <Field label="风味标签"><input value={profileText} onChange={(e) => setProfileText(e.target.value)} placeholder="酸甜、花香、清爽" /></Field>
        <Field label="口味与介绍"><textarea value={recipe.description} onChange={(e) => update('description', e.target.value)} rows={3} placeholder="描述香气、口感和适合的场景" /></Field>
        <div className="editor-title"><h2>材料与份量</h2><button type="button" onClick={() => update('ingredients', [...recipe.ingredients, iBlank()])}><Plus />添加</button></div>
        <div className="ingredient-editor">{recipe.ingredients.map((item, index) => <div key={index}>
          <input className="ingredient-name" value={item.name} onChange={(e) => updateIngredient(recipe, update, index, 'name', e.target.value)} placeholder="原料" />
          <input type="number" min="0" step="0.5" value={item.amount} onChange={(e) => updateIngredient(recipe, update, index, 'amount', Number(e.target.value))} aria-label="数量" />
          <input value={item.unit} onChange={(e) => updateIngredient(recipe, update, index, 'unit', e.target.value)} aria-label="单位" />
          <button type="button" onClick={() => update('ingredients', recipe.ingredients.filter((_, i) => i !== index))} aria-label="删除材料"><Trash2 /></button>
        </div>)}</div>
        <div className="field-grid"><Field label="杯型"><input value={recipe.glass} onChange={(e) => update('glass', e.target.value)} placeholder="古典杯" /></Field><Field label="调制技法"><input value={recipe.method} onChange={(e) => update('method', e.target.value)} placeholder="摇和" /></Field></div>
        <Field label="装饰"><input value={recipe.garnish} onChange={(e) => update('garnish', e.target.value)} placeholder="柠檬皮" /></Field>
        <Field label={`酒精强度：${strengthLabel(recipe.strength)}`}><input type="range" min="0" max="3" step="1" value={recipe.strength} onChange={(e) => update('strength', Number(e.target.value) as Recipe['strength'])} /></Field>
        <div className="editor-title"><h2>调制步骤</h2><button type="button" onClick={() => update('steps', [...recipe.steps, ''])}><Plus />添加</button></div>
        <div className="step-editor">{recipe.steps.map((step, index) => <div key={index}><span>{index + 1}</span><textarea rows={2} value={step} onChange={(e) => update('steps', recipe.steps.map((value, i) => i === index ? e.target.value : value))} placeholder="描述这一步" /><button type="button" onClick={() => update('steps', recipe.steps.filter((_, i) => i !== index))}><Trash2 /></button></div>)}</div>
        <button className="editor-submit" type="submit">保存配方</button>
      </div>
    </form></div>
  );
}

const iBlank = (): Ingredient => ({ name: '', amount: 30, unit: 'ml' });
function updateIngredient<K extends keyof Ingredient>(recipe: Recipe, update: <T extends keyof Recipe>(key: T, value: Recipe[T]) => void, index: number, key: K, value: Ingredient[K]) {
  update('ingredients', recipe.ingredients.map((item, i) => i === index ? { ...item, [key]: value } : item));
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="field"><span>{label}{required && <b> *</b>}</span>{children}</label>;
}

const PROVIDERS = [
  { name: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  { name: 'DeepSeek 深度求索', endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
  { name: 'Moonshot Kimi', endpoint: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k' },
  { name: '智谱 GLM', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4-flash' },
  { name: '通义千问', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-plus' },
  { name: 'SiliconFlow 硅基流动', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', model: 'deepseek-ai/DeepSeek-V3' },
  { name: '自定义', endpoint: '', model: '' },
];

function ApiSettingsSheet({ initial, onClose, onSave }: { initial: ApiSettings; onClose: () => void; onSave: (v: ApiSettings) => void }) {
  const [value, setValue] = useState(initial);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const applyProvider = (name: string) => {
    const p = PROVIDERS.find((item) => item.name === name);
    if (p && p.endpoint) setValue((v) => ({ ...v, endpoint: p.endpoint, model: p.model }));
  };
  return <div className="overlay nested"><form className="api-sheet" onSubmit={(e) => { e.preventDefault(); onSave(value); }}>
    <div className="drag-handle" /><header><div><KeyRound /><h2>对话 API</h2></div><button type="button" onClick={onClose}><X /></button></header>
    <p>支持 OpenAI 兼容接口。选择下方提供商可直接填入地址与模型。</p>
    <Field label="提供商"><select value={PROVIDERS.some((p) => p.endpoint === value.endpoint) ? PROVIDERS.find((p) => p.endpoint === value.endpoint)!.name : '自定义'} onChange={(e) => applyProvider(e.target.value)}>{PROVIDERS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select></Field>
    <Field label="接口地址"><input type="url" required value={value.endpoint} onChange={(e) => setValue({ ...value, endpoint: e.target.value })} /></Field>
    <Field label="模型"><input required value={value.model} onChange={(e) => setValue({ ...value, model: e.target.value })} placeholder="gpt-4o-mini" /></Field>
    <Field label="API 密钥"><input type="password" value={value.apiKey} onChange={(e) => setValue({ ...value, apiKey: e.target.value })} placeholder="sk-..." /></Field>
    <button type="button" className="test-button" onClick={async () => { setTesting(true); setTestResult(null); const r = await testConnection(value); setTestResult(r); setTesting(false); }} disabled={testing}>
      {testing ? '正在测试…' : '测试连接'}
    </button>
    {testResult && <div className={`test-result ${testResult.ok ? 'ok' : 'fail'}`}>{testResult.detail}</div>}
    <small>密钥与设置仅保存在本设备。无法直连海外接口时，可选用国内提供商（DeepSeek / Kimi / 智谱 / 通义千问）。</small>
    <button className="editor-submit" type="submit">保存设置</button>
  </form></div>;
}

function Empty({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) {
  return <div className="empty"><Icon /><strong>{title}</strong><p>{text}</p></div>;
}

export default App;
