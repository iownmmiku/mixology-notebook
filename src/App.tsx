import {
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  BookOpen,
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Edit3,
  ExternalLink,
  FlaskConical,
  GlassWater,
  Heart,
  KeyRound,
  LoaderCircle,
  Minus,
  PackageCheck,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShoppingBag,
  Sparkles,
  Star,
  Timer,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { builtInRecipes, commonPantry } from "./data/recipes";
import { postChatCompletion, testConnection, type TestResult } from "./api";
import {
  isAlcoholicIngredient,
  missingFor,
  normalizeIngredient,
  pantryMatches,
  recommendRecipes,
  selectRecipeContext,
  shoppingSuggestions,
} from "./domain";
import { storage } from "./storage";
import { exportBackupFile } from "./backupExport";
import { useAndroidBack } from "./useAndroidBack";
import type { ApiSettings, ChatMessage, Ingredient, Recipe } from "./types";

type Tab = "recipes" | "pantry" | "chat" | "profile";
type Filter = "全部" | "经典" | "现代" | "无酒精" | "特调" | "收藏";
type Note = { rating: number; text: string };
type Notebook = {
  favorites: string[];
  recent: { recipeId: string; date: string }[];
  notes: Record<string, Note>;
};
const tidy = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "");
const strengthLabel = (value: Recipe["strength"]) =>
  ["无酒精", "轻盈", "适中", "浓烈"][value];
const dateKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });
const tabs: {
  id: Tab;
  label: string;
  subtitle: string;
  icon: typeof BookOpen;
}[] = [
  { id: "recipes", label: "配方库", subtitle: "发现下一杯", icon: BookOpen },
  {
    id: "pantry",
    label: "我的酒柜",
    subtitle: "用手边的原料",
    icon: PackageCheck,
  },
  { id: "chat", label: "调酒师", subtitle: "聊聊你的口味", icon: Bot },
  {
    id: "profile",
    label: "我的手册",
    subtitle: "记录每一次尝试",
    icon: UserRound,
  },
];
function App() {
  const [tab, setTab] = useState<Tab>("recipes");
  useAndroidBack(tab, () => setTab("recipes"));
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>(
    storage.getRecipes,
  );
  const [pantry, setPantry] = useState<string[]>(storage.getPantry);
  const [notebook, setNotebook] = useState<Notebook>(storage.getNotebook);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);
  const [toast, setToast] = useState("");
  const [revision, setRevision] = useState(0);
  const [issues, setIssues] = useState<string[]>(() => {
    storage.getApi();
    return storage.getIssues();
  });
  const mainRef = useRef<HTMLElement>(null);
  const recipes = useMemo(
    () => [
      ...customRecipes,
      ...builtInRecipes.filter(
        (item) => !customRecipes.some((custom) => custom.id === item.id),
      ),
    ],
    [customRecipes],
  );
  const notify = (message: string) => setToast(message);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [tab]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const saveNotebook = (value: Notebook) => {
    const result = storage.saveNotebook(value);
    if (!result.ok) {
      setIssues(storage.getIssues());
      notify(result.error || "保存失败，请先导出备份再重试");
      return false;
    }
    setNotebook(value);
    return true;
  };
  const toggleFavorite = (id: string) =>
    saveNotebook({
      ...notebook,
      favorites: notebook.favorites.includes(id)
        ? notebook.favorites.filter((item) => item !== id)
        : [...notebook.favorites, id],
    });
  const updatePantry = (value: string[]) => {
    const result = storage.savePantry(value);
    if (!result.ok) {
      setIssues(storage.getIssues());
      notify(result.error || "酒柜保存失败");
      return;
    }
    setPantry(value);
  };
  const saveRecipe = (recipe: Recipe) => {
    const next = [
      recipe,
      ...customRecipes.filter((item) => item.id !== recipe.id),
    ];
    const result = storage.saveRecipes(next);
    if (!result.ok) {
      setIssues(storage.getIssues());
      notify(result.error || "配方保存失败");
      return;
    }
    setCustomRecipes(next);
    setSelected(recipe);
    setEditing(null);
    notify("配方已保存");
  };
  const deleteRecipe = (recipe: Recipe) => {
    const builtin = builtInRecipes.find((item) => item.id === recipe.id);
    if (
      !window.confirm(
        builtin
          ? "撤销修改并恢复内置配方？"
          : `删除「${recipe.name}」？确定删除这份个人配方？`,
      )
    )
      return;
    const next = customRecipes.filter((item) => item.id !== recipe.id);
    const result = storage.saveRecipes(next);
    if (!result.ok) {
      setIssues(storage.getIssues());
      notify(result.error || "删除失败");
      return;
    }
    setCustomRecipes(next);
    setSelected(builtin || null);
    notify(builtin ? "已恢复内置配方" : "配方已删除");
  };
  const complete = (recipe: Recipe) => {
    if (
      saveNotebook({
        ...notebook,
        recent: [
          { recipeId: recipe.id, date: new Date().toISOString() },
          ...notebook.recent,
        ].slice(0, 60),
      })
    ) {
      notify("已记入最近调制，记下这杯的味道吧");
      return true;
    }
    return false;
  };
  const afterImport = () => {
    setCustomRecipes(storage.getRecipes());
    setPantry(storage.getPantry());
    setNotebook(storage.getNotebook());
    setIssues(storage.getIssues());
    setRevision((value) => value + 1);
    notify("本地数据已更新");
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setTab("recipes");
          }}
        >
          <span className="brand-icon">
            <FlaskConical size={23} />
          </span>
          <span>
            <strong>调酒手册</strong>
            <small>MIXOLOGY NOTEBOOK</small>
          </span>
        </a>
        <p className="sidebar-label">你的私人酒吧</p>
        <nav aria-label="主导航" className="desktop-nav">
          {tabs.map(({ id, label, subtitle, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              aria-current={tab === id ? "page" : undefined}
              aria-label={label}
              onClick={() => setTab(id)}
            >
              <Icon size={21} />
              <span>
                <b>{label}</b>
                <small>{subtitle}</small>
              </span>
              {tab === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="small-label">一杯好酒，从好奇开始</span>
          <p>
            慢慢探索，认真记录。
            <br />
            找到属于你的那一杯。
          </p>
          <span className="sidebar-edition">PERSONAL EDITION · 02</span>
        </div>
      </aside>
      <main
        className={`main-content ${tab === "chat" ? "chat-main" : ""}`}
        ref={mainRef}
        inert={selected || editing ? true : undefined}
      >
        {issues.length > 0 && (
          <div className="issue-banner" role="alert">
            <div>
              <b>部分本地数据暂时无法读取</b>
              <p>
                {issues.join("；")}。请到我的手册导入有效备份，或恢复本机快照。
              </p>
            </div>
            <button aria-label="关闭提示" onClick={() => setIssues([])}>
              <X size={18} />
            </button>
          </div>
        )}
        <div hidden={tab !== "recipes"}>
          <RecipeLibrary
            recipes={recipes}
            favorites={notebook.favorites}
            pantry={pantry}
            onSelect={setSelected}
            onCreate={() => setEditing("new")}
            onFavorite={toggleFavorite}
          />
        </div>
        <div hidden={tab !== "pantry"}>
          <Pantry
            recipes={recipes}
            pantry={pantry}
            setPantry={updatePantry}
            onSelect={setSelected}
          />
        </div>
        <div hidden={tab !== "chat"} className="chat-container">
          <Bartender
            key={revision}
            recipes={recipes}
            pantry={pantry}
            onSelect={setSelected}
            notify={notify}
            active={tab === "chat"}
          />
        </div>
        <div hidden={tab !== "profile"}>
          <Profile
            recipes={recipes}
            customRecipes={customRecipes}
            notebook={notebook}
            pantry={pantry}
            onSelect={setSelected}
            onCreate={() => setEditing("new")}
            onImported={afterImport}
            notify={notify}
          />
        </div>
      </main>
      <nav className="bottom-nav" aria-label="移动端主导航">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {selected && !editing && (
        <RecipeDetail
          key={selected.id}
          recipe={selected}
          pantry={pantry}
          favorite={notebook.favorites.includes(selected.id)}
          note={notebook.notes[selected.id] || { rating: 0, text: "" }}
          onFavorite={() => toggleFavorite(selected.id)}
          onSaveNote={(note) => {
            if (
              saveNotebook({
                ...notebook,
                notes: { ...notebook.notes, [selected.id]: note },
              })
            ) {
              notify("口味笔记已保存");
              return true;
            }
            return false;
          }}
          onComplete={() => complete(selected)}
          isSaved={customRecipes.some((item) => item.id === selected.id)}
          onClose={() => setSelected(null)}
          onEdit={() => setEditing(selected)}
          onCopy={() =>
            setEditing({
              ...selected,
              id: `custom-${crypto.randomUUID()}`,
              name: `${selected.name} · 我的版本`,
              sourceLabel: `个人改编 · ${(selected.sourceLabel || "手册收录配方").replace("（已核对）", "")}`,
              isCustom: true,
            })
          }
          onDelete={() => deleteRecipe(selected)}
        />
      )}
      {editing && (
        <RecipeEditor
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={saveRecipe}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>
          {title}
          <span className="title-dot">.</span>
        </h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
function SectionHeading({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2>
        {title}
        {count && <span>{count}</span>}
      </h2>
      {children}
    </div>
  );
}
function RecipeLibrary({
  recipes,
  favorites,
  pantry,
  onSelect,
  onCreate,
  onFavorite,
}: {
  recipes: Recipe[];
  favorites: string[];
  pantry: string[];
  onSelect: (r: Recipe) => void;
  onCreate: () => void;
  onFavorite: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("全部");
  const [base, setBase] = useState("全部基酒");
  const [visible, setVisible] = useState(24);
  const bases = [...new Set(recipes.map((recipe) => recipe.base))].sort(
    (a, b) => a.localeCompare(b, "zh-CN"),
  );
  const filtered = recipes.filter(
    (recipe) =>
      (filter === "全部" ||
        (filter === "收藏"
          ? favorites.includes(recipe.id)
          : filter === "无酒精"
            ? recipe.strength === 0
            : recipe.era === filter)) &&
      (base === "全部基酒" || recipe.base === base) &&
      (!query ||
        tidy(
          [
            recipe.name,
            recipe.englishName,
            recipe.base,
            recipe.description,
            ...recipe.profile,
            ...recipe.ingredients.map((item) => item.name),
          ].join(" "),
        ).includes(tidy(query)) ||
        recipe.ingredients.some((item) =>
          normalizeIngredient(item.name).includes(normalizeIngredient(query)),
        )),
  );
  const dayHash =
    Array.from(dateKey()).reduce(
      (sum, letter) => sum * 31 + letter.charCodeAt(0),
      0,
    ) >>> 0;
  const stableRecipes = [...recipes].sort((a, b) => a.id.localeCompare(b.id));
  const featured = stableRecipes[dayHash % stableRecipes.length];
  useEffect(() => setVisible(24), [query, filter, base]);
  return (
    <section className="screen library-screen">
      <PageHeader
        eyebrow="THE COCKTAIL COLLECTION"
        title="发现你的下一杯"
        description="经典的比例，新的灵感。让每一杯都值得记录。"
        action={
          <button
            className="button outline new-recipe"
            aria-label="新建配方"
            onClick={onCreate}
          >
            <Plus size={18} />
            <span>新建配方</span>
          </button>
        }
      />
      {featured && !query && filter === "全部" && base === "全部基酒" && (
        <div className="hero-grid">
          <button className="feature" onClick={() => onSelect(featured)}>
            <div className="feature-copy">
              <span className="feature-label">
                <Sparkles size={15} />
                每日一杯 <i /> {formatDate(`${dateKey()}T12:00:00`)}
              </span>
              <h2>{featured.name}</h2>
              <p className="english-name">{featured.englishName}</p>
              <p className="feature-description">{featured.description}</p>
              <div className="profile-row">
                {featured.profile.slice(0, 3).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <span className="feature-link">
                探索这杯酒 <ArrowRight size={17} />
              </span>
            </div>
            <div className="feature-art">
              <span className="art-circle" />
              <CocktailVisual recipe={featured} large />
              <span className="art-caption">THE ART OF MIXING</span>
            </div>
          </button>
          <div className="library-note">
            <span className="small-label">FROM YOUR BAR</span>
            <PackageCheck size={25} />
            <strong>
              {
                pantryMatches(recipes, pantry).filter(
                  (item) => !item.missing.length,
                ).length
              }
              <span>杯</span>
            </strong>
            <h3>原料已经就绪</h3>
            <p>
              {pantry.length
                ? `你已记录 ${pantry.length} 种原料。下一杯灵感，就在手边。`
                : "把家里的酒和辅料放进酒柜，发现现在就能调的配方。"}
            </p>
            <span className="note-rule" />
            <small>{recipes.length} 杯配方 · 每一次都可复现</small>
          </div>
        </div>
      )}
      <div className="library-toolbar">
        <div className="search-box">
          <Search size={19} />
          <input
            aria-label="搜索配方"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索酒名、原料或风味…"
          />
          {query && (
            <button aria-label="清空搜索" onClick={() => setQuery("")}>
              <X size={17} />
            </button>
          )}
        </div>
        <label className="base-select">
          <GlassWater size={17} />
          <select
            aria-label="按基酒筛选"
            value={base}
            onChange={(event) => setBase(event.target.value)}
          >
            <option>全部基酒</option>
            {bases.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>
      </div>
      <div className="filter-row" aria-label="配方分类">
        {(["全部", "经典", "现代", "无酒精", "特调", "收藏"] as Filter[]).map(
          (item) => (
            <button
              key={item}
              aria-pressed={filter === item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              {item === "收藏" && <Heart size={14} />}
              {item}
            </button>
          ),
        )}
      </div>
      <SectionHeading
        title={
          query
            ? "搜索结果"
            : filter === "全部"
              ? "配方收藏集"
              : filter === "收藏"
                ? "我的收藏"
                : `${filter}配方`
        }
        count={`${filtered.length} 杯`}
      >
        <span className="section-caption">调一杯，记一页。</span>
      </SectionHeading>
      <div className="recipe-grid">
        {filtered.slice(0, visible).map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            favorite={favorites.includes(recipe.id)}
            onFavorite={() => onFavorite(recipe.id)}
            onClick={() => onSelect(recipe)}
          />
        ))}
      </div>
      {!filtered.length && (
        <Empty
          icon={Search}
          title="还没有找到这杯酒"
          text={
            filter === "收藏"
              ? "打开喜欢的配方，点一下爱心，把它留在这里。"
              : "试试其他原料或风味，也可以清除筛选。"
          }
        />
      )}
      {visible < filtered.length && (
        <button
          className="button outline load-more"
          onClick={() => setVisible((value) => value + 24)}
        >
          继续探索 <ChevronDown size={16} />
          <span>{filtered.length - visible} 杯待发现</span>
        </button>
      )}
      <footer className="page-footer">
        <FlaskConical size={15} /> 以好奇为起点，以一杯为单位。
      </footer>
    </section>
  );
}
function CocktailVisual({
  recipe,
  large = false,
}: {
  recipe: Recipe;
  large?: boolean;
}) {
  const tall = /高球|柯林|飓风|铜杯|耐热|朱莉普/.test(recipe.glass);
  return (
    <svg
      className={`cocktail-visual ${large ? "large" : ""}`}
      viewBox="0 0 160 190"
      aria-hidden="true"
      style={{ "--drink": recipe.color } as CSSProperties}
    >
      <ellipse
        cx="80"
        cy="173"
        rx="49"
        ry="7"
        fill="currentColor"
        opacity=".06"
      />
      {tall ? (
        <>
          <path
            d="M43 32h74l-7 128q-30 10-60 0Z"
            fill="currentColor"
            opacity=".08"
          />
          <path
            d="M49 60h62l-6 92q-25 8-50 0Z"
            fill={recipe.color}
            opacity=".85"
          />
          <path
            d="M43 32h74l-7 128q-30 10-60 0Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            opacity=".5"
          />
          <ellipse
            cx="80"
            cy="33"
            rx="37"
            ry="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity=".5"
          />
          <rect
            x="58"
            y="75"
            width="23"
            height="24"
            rx="5"
            fill="#fff"
            opacity=".28"
            transform="rotate(14 70 86)"
          />
          <rect
            x="82"
            y="108"
            width="18"
            height="19"
            rx="4"
            fill="#fff"
            opacity=".2"
            transform="rotate(-15 90 118)"
          />
          <path
            d="M95 29l-6 99"
            stroke="currentColor"
            strokeWidth="2"
            opacity=".4"
          />
          <circle cx="47" cy="53" r="18" fill="#ddba56" />
          <circle
            cx="47"
            cy="53"
            r="13"
            fill="none"
            stroke="#f3dfa0"
            strokeWidth="2"
          />
          <path d="M47 41v24M35 53h24" stroke="#f3dfa0" strokeWidth="1" />
        </>
      ) : (
        <>
          <path
            d="M22 39h116q-6 48-58 58Q28 87 22 39Z"
            fill="currentColor"
            opacity=".07"
          />
          <path
            d="M28 51h104q-11 31-52 39-39-8-52-39Z"
            fill={recipe.color}
            opacity=".94"
          />
          <ellipse cx="80" cy="50" rx="52" ry="6" fill={recipe.color} />
          <path
            d="M22 39h116q-6 48-58 58Q28 87 22 39Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity=".5"
          />
          <ellipse
            cx="80"
            cy="39"
            rx="58"
            ry="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity=".5"
          />
          <path
            d="M80 97v60"
            stroke="currentColor"
            strokeWidth="2.5"
            opacity=".65"
          />
          <ellipse
            cx="80"
            cy="159"
            rx="31"
            ry="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity=".5"
          />
          <path
            d="M35 47q7 28 29 34"
            stroke="#fff"
            strokeWidth="2"
            fill="none"
            opacity=".4"
          />
          <path
            d="M103 27q12 2 17 17"
            stroke="#d4b45c"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M103 27q12 2 17 17"
            stroke="#f0d584"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
function RecipeCard({
  recipe,
  favorite,
  onFavorite,
  onClick,
}: {
  recipe: Recipe;
  favorite: boolean;
  onFavorite: () => void;
  onClick: () => void;
}) {
  return (
    <article className="recipe-card">
      <button
        className="card-open"
        onClick={onClick}
        aria-label={`查看${recipe.name}配方`}
      >
        <div
          className="card-visual"
          style={{ "--drink": recipe.color } as CSSProperties}
        >
          <span className="card-category">
            {recipe.isCustom ? "我的版本" : recipe.era}
          </span>
          <CocktailVisual recipe={recipe} />
          <span className="card-visual-line" />
        </div>
        <div className="card-copy">
          <h3>{recipe.name}</h3>
          <p className="english-name">
            {recipe.englishName || "MY ORIGINAL RECIPE"}
          </p>
          <div className="card-meta">
            <span>{recipe.base || "原创"}</span>
            <span className="strength">
              <i className={recipe.strength > 0 ? "on" : ""} />
              <i className={recipe.strength > 1 ? "on" : ""} />
              <i className={recipe.strength > 2 ? "on" : ""} />
              {strengthLabel(recipe.strength)}
            </span>
          </div>
          <div className="card-tags">
            {recipe.profile.slice(0, 3).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </button>
      <button
        className={`favorite-button ${favorite ? "active" : ""}`}
        aria-label={`${favorite ? "取消收藏" : "收藏"}${recipe.name}`}
        aria-pressed={favorite}
        onClick={onFavorite}
      >
        <Heart size={17} fill={favorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
function RecipeRow({
  recipe,
  onClick,
  aside,
}: {
  recipe: Recipe;
  onClick: () => void;
  aside?: ReactNode;
}) {
  return (
    <button className="recipe-row" onClick={onClick}>
      <span className="row-visual">
        <CocktailVisual recipe={recipe} />
      </span>
      <span className="recipe-row-copy">
        <strong>{recipe.name}</strong>
        <small>{recipe.englishName || recipe.base}</small>
        <span>
          {recipe.profile.slice(0, 2).join(" · ")}
          {recipe.profile.length ? " · " : ""}
          {strengthLabel(recipe.strength)}
        </span>
      </span>
      {aside || <ChevronRight size={18} />}
    </button>
  );
}
function Pantry({
  recipes,
  pantry,
  setPantry,
  onSelect,
}: {
  recipes: Recipe[];
  pantry: string[];
  setPantry: (value: string[]) => void;
  onSelect: (recipe: Recipe) => void;
}) {
  const [input, setInput] = useState("");
  const [visible, setVisible] = useState(8);
  const [readyVisible, setReadyVisible] = useState(8);
  const ingredientNames = [
    ...new Set([
      ...commonPantry,
      ...recipes.flatMap((item) =>
        item.ingredients.map((ingredient) => ingredient.name),
      ),
    ]),
  ];
  const suggestions = ingredientNames
    .filter(
      (name) =>
        !pantry.some(
          (item) => normalizeIngredient(item) === normalizeIngredient(name),
        ) &&
        (!input || tidy(name).includes(tidy(input))),
    )
    .slice(0, 8);
  const matches = useMemo(
    () => pantryMatches(recipes, pantry),
    [recipes, pantry],
  );
  const exact = matches.filter((item) => !item.missing.length);
  const close = matches.filter(
    (item) => item.missing.length > 0 && item.missing.length <= 2,
  );
  const shopping = useMemo(
    () => shoppingSuggestions(recipes, pantry).slice(0, 4),
    [recipes, pantry],
  );
  const add = (name: string) => {
    const value = name.trim();
    if (
      value &&
      !pantry.some(
        (item) => normalizeIngredient(item) === normalizeIngredient(value),
      )
    )
      setPantry([...pantry, value]);
    setInput("");
  };
  return (
    <section className="screen">
      <PageHeader
        eyebrow="YOUR HOME BAR"
        title="好原料，就在手边"
        description="记下家里的酒与辅料，看看下一杯能做什么。"
        action={
          <span className="header-count">
            <PackageCheck size={19} />
            {pantry.length} 种原料
          </span>
        }
      />
      <div className="pantry-layout">
        <div className="pantry-inventory panel">
          <SectionHeading title="我的原料" count={`${pantry.length}`} />
          <form
            className="ingredient-add"
            onSubmit={(event) => {
              event.preventDefault();
              add(input);
            }}
          >
            <Search size={18} />
            <input
              aria-label="添加或搜索酒柜原料"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="输入酒名或辅料…"
            />
            <button aria-label="添加原料" disabled={!input.trim()}>
              <Plus size={20} />
            </button>
          </form>
          {input && (
            <div className="suggestions">
              {suggestions.map((name) => (
                <button key={name} onClick={() => add(name)}>
                  {name}
                  <Plus size={15} />
                </button>
              ))}
            </div>
          )}
          <div className="pantry-chips">
            {pantry.map((name) => (
              <button
                key={name}
                onClick={() =>
                  setPantry(pantry.filter((item) => item !== name))
                }
                aria-label={`移除${name}`}
              >
                {name}
                <X size={13} />
              </button>
            ))}
          </div>
          {!pantry.length && (
            <p className="muted-text inventory-empty">
              先选一瓶基酒，再加一些果汁、糖浆和气泡。
            </p>
          )}
          <span className="small-label">
            {input ? "也可以直接添加输入的原料" : "常用原料 · 点击加入"}
          </span>
          <div className="quick-pantry">
            {suggestions.slice(0, input ? 0 : 8).map((name) => (
              <button key={name} onClick={() => add(name)}>
                <Plus size={13} />
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="match-summary">
          <span className="small-label">THE POSSIBILITIES</span>
          <div>
            <strong>
              {exact.length}
              <span>杯</span>
            </strong>
            <p>现在就能调</p>
          </div>
          <div>
            <strong>
              {close.length}
              <span>杯</span>
            </strong>
            <p>只差一两样</p>
          </div>
          <small>按必需原料匹配，可选装饰不计入缺料</small>
        </div>
      </div>
      {shopping.length > 0 && (
        <div className="shopping-panel">
          <div>
            <span className="small-label">ONE MORE INGREDIENT</span>
            <h2>
              <ShoppingBag size={20} />
              买一样，多一些可能
            </h2>
            <p>补齐下面的原料，可以完整解锁这些配方。</p>
          </div>
          <div className="shopping-grid">
            {shopping.map(({ ingredient, unlocks }) => (
              <div key={ingredient}>
                <b>{ingredient}</b>
                <span>
                  新解锁 <strong>{unlocks}</strong> 杯
                </span>
                <button
                  onClick={() => add(ingredient)}
                  aria-label={`将${ingredient}加入酒柜`}
                >
                  <Plus size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="match-columns">
        <div>
          <SectionHeading title="现在能调" count={`${exact.length} 杯`} />
          <div className="recipe-list panel">
            {exact.slice(0, readyVisible).map(({ recipe }) => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                onClick={() => onSelect(recipe)}
                aside={
                  <span className="ready">
                    <Check size={14} />
                    齐了
                  </span>
                }
              />
            ))}
            {!exact.length && (
              <Empty
                icon={GlassWater}
                title="再添一点原料"
                text="记录家里的辅料，或从缺料清单找点灵感。"
              />
            )}
          </div>
          {readyVisible < exact.length && (
            <button
              className="text-button load-more"
              onClick={() => setReadyVisible((value) => value + 8)}
            >
              查看更多 <ChevronDown size={16} />
            </button>
          )}
        </div>
        <div>
          <SectionHeading title="差一点就能调" count={`${close.length} 杯`} />
          <div className="recipe-list panel">
            {close.slice(0, visible).map(({ recipe, missing }) => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                onClick={() => onSelect(recipe)}
                aside={
                  <span className="missing">还缺 {missing.join("、")}</span>
                }
              />
            ))}
            {!close.length && (
              <Empty
                icon={FlaskConical}
                title="从一瓶基酒开始"
                text="加进你的第一种原料，看看新的搭配。"
              />
            )}
          </div>
          {visible < close.length && (
            <button
              className="text-button load-more"
              onClick={() => setVisible((value) => value + 8)}
            >
              查看更多 <ChevronDown size={16} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
type DisplayMessage = ChatMessage & { recipeIds?: string[] };
function Bartender({
  recipes,
  pantry,
  onSelect,
  notify,
  active,
}: {
  recipes: Recipe[];
  pantry: string[];
  onSelect: (recipe: Recipe) => void;
  notify: (value: string) => void;
  active: boolean;
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<ApiSettings>(storage.getApi);
  const [tested, setTested] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [failure, setFailure] = useState("");
  const controller = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastRequest = useRef<DisplayMessage[]>([]);
  useEffect(() => {
    if (active)
      bodyRef.current?.scrollTo({
        top: bodyRef.current.scrollHeight,
        behavior: "smooth",
      });
  }, [messages, loading, active]);
  useEffect(() => () => controller.current?.abort(), []);
  const request = async (next: DisplayMessage[]) => {
    const requestController = new AbortController();
    controller.current = requestController;
    setLoading(true);
    setFailure("");
    lastRequest.current = next;
    try {
      const context = selectRecipeContext(
        next[next.length - 1]?.content || "",
        recipes,
        pantry,
      );
      const answer = await postChatCompletion(
        settings,
        next.slice(-12).map(({ role, content }) => ({ role, content })),
        pantry,
        context,
        requestController.signal,
      );
      if (!requestController.signal.aborted) {
        setMessages([...next, { role: "assistant", content: answer }]);
        setTested(true);
      }
    } catch (error) {
      if (!requestController.signal.aborted)
        setFailure(
          error instanceof Error ? error.message : "连接失败，请检查设置后重试",
        );
    } finally {
      if (controller.current === requestController) {
        setLoading(false);
        controller.current = null;
      }
    }
  };
  const send = async (preset?: string) => {
    const question = (preset ?? input).trim();
    if (!question || loading) return;
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    setFailure("");
    if (settings.apiKey.trim()) {
      await request(next);
      return;
    }
    const recommendations = recommendRecipes(question, recipes, pantry, 4);
    const content = recommendations.length
      ? `根据你的要求，挑了 ${recommendations.length} 杯配方。点开看看比例和步骤${pantry.length ? "，缺少的原料也会一起列出" : ""}。`
      : "配方库里暂时没有同时满足这些条件的配方。试试放宽风味要求，或换一种基酒。";
    setMessages([
      ...next,
      {
        role: "assistant",
        content,
        recipeIds: recommendations.map((item) => item.id),
      },
    ]);
  };
  const cancel = () => {
    controller.current?.abort();
    setLoading(false);
    setFailure("已停止生成。你可以重试这条消息。");
  };
  const clear = () => {
    if (messages.length && window.confirm("清空这段对话？")) {
      controller.current?.abort();
      setMessages([]);
      setFailure("");
      setLoading(false);
    }
  };
  return (
    <section className="screen chat-screen">
      <PageHeader
        eyebrow="A LITTLE GUIDANCE"
        title="今晚，想喝什么"
        description="从你的酒柜出发，聊聊风味、比例与灵感。"
        action={
          <div className="header-actions">
            <button
              className="icon-button"
              onClick={clear}
              aria-label="清空对话"
              disabled={!messages.length}
            >
              <Trash2 size={18} />
            </button>
            <button
              className="button outline"
              aria-label="对话设置"
              disabled={loading}
              onClick={() => setShowSettings(true)}
            >
              <Settings2 size={17} />
              <span>对话设置</span>
            </button>
          </div>
        }
      />
      <div className={`connection-state ${tested ? "online" : ""}`}>
        <span />
        {settings.apiKey
          ? tested
            ? "连接测试成功"
            : "API 已配置 · 尚未验证"
          : "离线推荐"}
        <span className="connection-detail">
          {settings.apiKey ? settings.model : "使用本地配方库，无需密钥"}
        </span>
      </div>
      <div className="chat-body" ref={bodyRef}>
        {!messages.length && (
          <div className="chat-welcome">
            <span className="bot-mark">
              <Bot size={31} />
            </span>
            <span className="small-label">YOUR PERSONAL BARTENDER</span>
            <h2>从一点好奇开始。</h2>
            <p>告诉我手边有什么，或今天想要什么味道。</p>
            <div className="prompt-grid">
              {[
                "用我的酒柜能调什么？",
                "推荐一杯无酒精酸甜饮品",
                "来一杯清爽的金酒鸡尾酒",
                "不要金酒，推荐浓烈的经典",
              ].map((text) => (
                <button key={text} onClick={() => send(text)}>
                  <Sparkles size={16} />
                  {text}
                  <ArrowUpFromLine size={15} />
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            {message.role === "assistant" && (
              <span className="avatar">
                <Bot size={17} />
              </span>
            )}
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              {message.recipeIds && (
                <div className="chat-recipes">
                  {message.recipeIds.map((id) => {
                    const recipe = recipes.find((item) => item.id === id);
                    if (!recipe) return null;
                    const missing = missingFor(recipe, pantry);
                    return (
                      <RecipeRow
                        key={id}
                        recipe={recipe}
                        onClick={() => onSelect(recipe)}
                        aside={
                          pantry.length ? (
                            <span
                              className={missing.length ? "missing" : "ready"}
                            >
                              {missing.length
                                ? `缺 ${missing.join("、")}`
                                : "酒柜已备齐"}
                            </span>
                          ) : (
                            <ChevronRight size={16} />
                          )
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <span className="avatar">
              <Bot size={17} />
            </span>
            <div className="message-text thinking">
              <LoaderCircle className="spin" size={17} />
              正在寻找这杯的灵感…
            </div>
          </div>
        )}
        {failure && (
          <div className="chat-error" role="alert">
            <p>{failure}</p>
            <button
              className="text-button"
              onClick={() => request(lastRequest.current)}
              disabled={loading || !lastRequest.current.length}
            >
              <RotateCcw size={15} />
              重试
            </button>
          </div>
        )}
      </div>
      <form
        className="chat-input"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          rows={1}
          aria-label="给调酒师的消息"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="问配方、风味，或说说你的原料…"
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              send();
            }
          }}
        />
        {loading ? (
          <button type="button" onClick={cancel} aria-label="停止生成">
            <X size={19} />
          </button>
        ) : (
          <button disabled={!input.trim()} aria-label="发送消息">
            <Send size={19} />
          </button>
        )}
      </form>
      <p className="chat-caption">
        {settings.apiKey
          ? "一次一杯，按需探索。"
          : "离线模式会按条件推荐本地配方；设置 API 后可进行自由对话。"}
      </p>
      {showSettings && (
        <ApiSettingsSheet
          initial={settings}
          onClose={() => setShowSettings(false)}
          onSave={(value, wasTested) => {
            const result = storage.saveApi(value);
            if (!result.ok) {
              notify(result.error || "设置保存失败");
              return;
            }
            setSettings(value);
            setTested(wasTested);
            setShowSettings(false);
            notify("对话设置已保存");
          }}
        />
      )}
    </section>
  );
}
function Profile({
  recipes,
  customRecipes,
  notebook,
  pantry,
  onSelect,
  onCreate,
  onImported,
  notify,
}: {
  recipes: Recipe[];
  customRecipes: Recipe[];
  notebook: Notebook;
  pantry: string[];
  onSelect: (recipe: Recipe) => void;
  onCreate: () => void;
  onImported: () => void;
  notify: (message: string) => void;
}) {
  const [view, setView] = useState<"收藏" | "我的配方" | "最近调制">("收藏");
  const [exporting, setExporting] = useState(false);
  const exportInProgress = useRef(false);
  const [visible, setVisible] = useState(10);
  const fileRef = useRef<HTMLInputElement>(null);
  const favorites = recipes.filter((recipe) =>
    notebook.favorites.includes(recipe.id),
  );
  const exportBackup = async () => {
    if (exportInProgress.current) return;
    exportInProgress.current = true;
    setExporting(true);
    try {
      notify(await exportBackupFile(storage.exportBackup()));
    } catch (error) {
      notify(error instanceof Error ? error.message : "导出失败，请重试");
    } finally {
      exportInProgress.current = false;
      setExporting(false);
    }
  };
  const importBackup = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      notify("文件超过 5 MB，请选择手册导出的备份");
      return;
    }
    if (
      !window.confirm(
        "导入会替换当前个人配方、酒柜与笔记。确认已导出当前备份后继续？",
      )
    )
      return;
    try {
      const result = storage.importBackup(await file.text());
      if (result.ok) onImported();
      else notify(result.error || "备份格式无效，当前数据未改变");
    } catch {
      notify("无法读取文件，当前数据未改变");
    }
  };
  const recover = () => {
    if (
      !window.confirm(
        "恢复到上一次保存前的快照？当前数据会被替换，请先导出备份。",
      )
    )
      return;
    const result = storage.recoverBackup();
    if (result.ok) onImported();
    else notify(result.error || "快照恢复失败");
  };
  useEffect(() => setVisible(10), [view]);
  const displayed = view === "收藏" ? favorites : customRecipes;
  return (
    <section className="screen">
      <PageHeader
        eyebrow="YOUR PERSONAL NOTEBOOK"
        title="每杯，都有你的故事"
        description="留下喜欢的配方，记录调整，慢慢找到自己的口味。"
        action={
          <button className="button outline" onClick={onCreate}>
            <Plus size={18} />
            新建配方
          </button>
        }
      />
      <div className="profile-summary">
        <div className="profile-monogram">
          <FlaskConical size={33} />
        </div>
        <div className="profile-intro">
          <span className="small-label">A NOTEBOOK OF YOUR OWN</span>
          <h2>我的调酒旅程</h2>
          <p>好的配方是起点，你的偏好才是答案。</p>
        </div>
        <div className="profile-stats">
          <div>
            <strong>{favorites.length}</strong>
            <span>收藏配方</span>
          </div>
          <div>
            <strong>{customRecipes.length}</strong>
            <span>个人配方</span>
          </div>
          <div>
            <strong>{notebook.recent.length}</strong>
            <span>调制记录</span>
          </div>
        </div>
      </div>
      <div className="filter-row">
        {(["收藏", "我的配方", "最近调制"] as const).map((item) => (
          <button
            key={item}
            className={view === item ? "active" : ""}
            aria-pressed={view === item}
            onClick={() => setView(item)}
          >
            {item === "收藏" ? (
              <Heart size={15} />
            ) : item === "最近调制" ? (
              <Clock3 size={15} />
            ) : (
              <BookOpen size={15} />
            )}
            {item}
          </button>
        ))}
      </div>
      <SectionHeading
        title={view}
        count={`${view === "最近调制" ? notebook.recent.length : displayed.length}`}
      />
      <div className="recipe-list panel">
        {view === "最近调制"
          ? notebook.recent.slice(0, visible).map((entry, index) => {
              const recipe = recipes.find((item) => item.id === entry.recipeId);
              return recipe ? (
                <RecipeRow
                  key={`${entry.date}-${index}`}
                  recipe={recipe}
                  onClick={() => onSelect(recipe)}
                  aside={
                    <span className="recent-date">
                      {formatDate(entry.date)}
                    </span>
                  }
                />
              ) : (
                <div className="deleted-recipe" key={`${entry.date}-${index}`}>
                  <span>配方已删除</span>
                  <small>{formatDate(entry.date)}</small>
                </div>
              );
            })
          : displayed.slice(0, visible).map((recipe) => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                onClick={() => onSelect(recipe)}
                aside={
                  notebook.notes[recipe.id]?.rating ? (
                    <span className="rating-badge">
                      <Star size={14} fill="currentColor" />
                      {notebook.notes[recipe.id].rating}
                    </span>
                  ) : undefined
                }
              />
            ))}
        {(view === "最近调制"
          ? !notebook.recent.length
          : !displayed.length) && (
          <Empty
            icon={
              view === "收藏" ? Heart : view === "最近调制" ? Clock3 : BookOpen
            }
            title={
              view === "收藏"
                ? "让喜欢的配方留在这里"
                : view === "最近调制"
                  ? "第一杯，就从今天开始"
                  : "写下你的第一份配方"
            }
            text={
              view === "收藏"
                ? "在配方卡片或详情里点击爱心，随时找回心头好。"
                : view === "最近调制"
                  ? "打开配方进入制作模式，完成后会自动记录。"
                  : "复制经典后微调，或者创建一杯自己的作品。"
            }
          />
        )}
      </div>
      {visible <
        (view === "最近调制" ? notebook.recent.length : displayed.length) && (
        <button
          className="text-button load-more"
          onClick={() => setVisible((value) => value + 10)}
        >
          查看更多 <ChevronDown size={16} />
        </button>
      )}
      <div className="backup-panel">
        <div>
          <span className="small-label">KEEP YOUR STORIES SAFE</span>
          <h2>给手册留一份备份</h2>
          <p>
            个人配方、{pantry.length} 种原料、收藏与笔记保存在这台设备。
            <br />
            换设备前，先导出一份；备份不包含 API 密钥。
          </p>
        </div>
        <div className="backup-actions">
          <button
            className="button outline"
            disabled={exporting}
            aria-busy={exporting}
            onClick={() => void exportBackup()}
          >
            {exporting ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <ArrowDownToLine size={17} />
            )}
            导出备份
          </button>
          <button
            className="button outline"
            onClick={() => fileRef.current?.click()}
          >
            <ArrowUpFromLine size={17} />
            导入备份
          </button>
          {storage.getRecoveryAvailable() && (
            <button className="text-button" onClick={recover}>
              <RotateCcw size={16} />
              恢复上次快照
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            aria-label="选择备份文件"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importBackup(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>
      <footer className="page-footer">
        <FlaskConical size={15} />
        MIXOLOGY NOTEBOOK · 你的私人调酒手册
      </footer>
    </section>
  );
}
function Dialog({
  children,
  label,
  onClose,
  className = "",
}: {
  children: ReactNode;
  label: string;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    const focusable = () =>
      [
        ...(panel?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea, select, a[href], [tabindex="0"]',
        ) || []),
      ].filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}
function RecipeDetail({
  recipe,
  pantry,
  favorite,
  note,
  onFavorite,
  onSaveNote,
  onComplete,
  isSaved,
  onClose,
  onEdit,
  onCopy,
  onDelete,
}: {
  recipe: Recipe;
  pantry: string[];
  favorite: boolean;
  note: Note;
  onFavorite: () => void;
  onSaveNote: (value: Note) => boolean;
  onComplete: () => boolean;
  isSaved: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [making, setMaking] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [draftNote, setDraftNote] = useState(note);
  const [didFinish, setDidFinish] = useState(false);
  const missing = missingFor(recipe, pantry);
  const noteDirty = JSON.stringify(note) !== JSON.stringify(draftNote);
  const allowLeave = () =>
    !noteDirty || window.confirm("口味笔记还没有保存，确定放弃修改？");
  const close = () => {
    if (allowLeave()) onClose();
  };
  useEffect(() => {
    if (!running) return;
    const started = Date.now() - seconds * 1000;
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      250,
    );
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (!making || !("wakeLock" in navigator)) return;
    let release: (() => void) | undefined;
    let ended = false;
    const acquire = async () => {
      try {
        const wake = await (
          navigator as Navigator & {
            wakeLock: {
              request: (
                type: string,
              ) => Promise<{ release: () => Promise<void> }>;
            };
          }
        ).wakeLock.request("screen");
        if (ended) await wake.release();
        else
          release = () => {
            void wake.release();
          };
      } catch {
        /* Optional on this device. */
      }
    };
    void acquire();
    const visibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      ended = true;
      release?.();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [making]);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <Dialog
      label={`${recipe.name}配方`}
      className="detail-sheet"
      onClose={close}
    >
      <div className="detail-hero">
        <div className="sheet-actions">
          <button onClick={close} aria-label="返回配方库">
            <ArrowLeft size={20} />
          </button>
          <div>
            <button
              onClick={onFavorite}
              aria-label={favorite ? "取消收藏" : "收藏配方"}
              aria-pressed={favorite}
            >
              <Heart size={19} fill={favorite ? "currentColor" : "none"} />
            </button>
            <button
              onClick={() => {
                if (allowLeave()) onEdit();
              }}
              aria-label="编辑配方"
            >
              <Edit3 size={19} />
            </button>
          </div>
        </div>
        <div className="detail-title">
          <span className="small-label">
            {recipe.era} / {recipe.base}
          </span>
          <h1>{recipe.name}</h1>
          <p className="english-name">{recipe.englishName}</p>
        </div>
        <CocktailVisual recipe={recipe} large />
      </div>
      <div className="detail-content">
        <div className="profile-row dark">
          {recipe.profile.map((item) => (
            <span key={item}>{item}</span>
          ))}
          <span>{strengthLabel(recipe.strength)}</span>
        </div>
        <p className="description">{recipe.description}</p>
        <div className="facts">
          <div>
            <small>杯型</small>
            <strong>{recipe.glass || "按喜好选择"}</strong>
          </div>
          <div>
            <small>调制技法</small>
            <strong>{recipe.method}</strong>
          </div>
          <div>
            <small>装饰</small>
            <strong>{recipe.garnish || "无需装饰"}</strong>
          </div>
        </div>
        <button
          className={`button primary make-button ${making ? "making" : ""}`}
          onClick={() => {
            setMaking((value) => !value);
            if (making) setRunning(false);
          }}
        >
          {making ? <BookOpen size={18} /> : <Play size={18} />}
          {making ? "返回阅读模式" : "开始调制"}
          <span>
            {making
              ? `${completed.length} / ${recipe.steps.length} 步`
              : "一步一步，慢慢来"}
          </span>
        </button>
        {making && (
          <div className="making-panel">
            <div className="making-title">
              <Timer size={19} />
              <strong>调制计时</strong>
              <span>{time}</span>
              <button
                className="icon-button"
                onClick={() => setRunning((value) => !value)}
                aria-label={running ? "暂停计时" : "开始计时"}
              >
                {running ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button
                className="icon-button"
                onClick={() => {
                  setRunning(false);
                  setSeconds(0);
                }}
                aria-label="重置计时"
              >
                <RotateCcw size={16} />
              </button>
            </div>
            <div className="progress-track">
              <span
                style={{
                  width: `${recipe.steps.length ? (completed.length / recipe.steps.length) * 100 : 0}%`,
                }}
              />
            </div>
            <p>完成一步就勾选；支持的设备会保持屏幕常亮。</p>
          </div>
        )}
        <SectionHeading title="所需材料">
          <div className="scale-control">
            <button
              onClick={() => setScale((value) => Math.max(0.5, value - 0.5))}
              aria-label="减少份量"
              disabled={scale <= 0.5}
            >
              <Minus size={14} />
            </button>
            <span>{scale} 杯</span>
            <button
              onClick={() => setScale((value) => Math.min(12, value + 0.5))}
              aria-label="增加份量"
              disabled={scale >= 12}
            >
              <Plus size={14} />
            </button>
          </div>
        </SectionHeading>
        <div className="ingredient-list">
          {recipe.ingredients.map((item, index) => (
            <div key={index}>
              <span>
                {item.name}
                {item.optional && <small>可选</small>}
                {pantry.length > 0 && !item.optional && (
                  <span
                    className={
                      missing.some(
                        (name) =>
                          normalizeIngredient(name) ===
                          normalizeIngredient(item.name),
                      )
                        ? "ingredient-missing"
                        : "ingredient-owned"
                    }
                  >
                    {missing.some(
                      (name) =>
                        normalizeIngredient(name) ===
                        normalizeIngredient(item.name),
                    ) ? (
                      "未备"
                    ) : (
                      <Check size={12} />
                    )}
                  </span>
                )}
              </span>
              <strong>
                {item.unit === "适量" ? (
                  "适量"
                ) : (
                  <>
                    {Number((item.amount * scale).toFixed(4))}{" "}
                    <small>{item.unit}</small>
                  </>
                )}
              </strong>
            </div>
          ))}
        </div>
        <SectionHeading
          title="调制步骤"
          count={making ? "点击勾选" : `${recipe.steps.length} 步`}
        />
        <ol className={`steps ${making ? "interactive" : ""}`}>
          {recipe.steps.map((step, index) => (
            <li
              key={index}
              className={completed.includes(index) && making ? "done" : ""}
            >
              {making ? (
                <button
                  className="step-toggle"
                  onClick={() =>
                    setCompleted((value) =>
                      value.includes(index)
                        ? value.filter((item) => item !== index)
                        : [...value, index],
                    )
                  }
                  aria-label={`${completed.includes(index) ? "取消完成" : "完成"}步骤 ${index + 1}`}
                  aria-pressed={completed.includes(index)}
                >
                  <span>
                    {completed.includes(index) ? (
                      <Check size={15} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <p>{step}</p>
                </button>
              ) : (
                <>
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </>
              )}
            </li>
          ))}
        </ol>
        {making && (
          <button
            className="button primary finish-button"
            disabled={completed.length < recipe.steps.length || didFinish}
            onClick={() => {
              if (onComplete()) {
                setRunning(false);
                setDidFinish(true);
              }
            }}
          >
            <CheckCheck size={18} />
            {didFinish
              ? "这一杯已记入手册"
              : completed.length < recipe.steps.length
                ? "完成全部步骤后记录这杯"
                : "完成，记入我的手册"}
          </button>
        )}
        <div className="note-editor">
          <SectionHeading title="这杯的味道" />
          <div className="note-rating" role="group" aria-label="配方评分">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() =>
                  setDraftNote((value) => ({
                    ...value,
                    rating: value.rating === rating ? 0 : rating,
                  }))
                }
                aria-label={`${rating}星`}
                aria-pressed={draftNote.rating === rating}
              >
                <Star
                  size={23}
                  fill={rating <= draftNote.rating ? "currentColor" : "none"}
                />
              </button>
            ))}
            <small>
              {draftNote.rating ? `${draftNote.rating} / 5` : "你的评分"}
            </small>
          </div>
          <textarea
            aria-label="个人口味笔记"
            rows={3}
            value={draftNote.text}
            onChange={(event) =>
              setDraftNote((value) => ({ ...value, text: event.target.value }))
            }
            placeholder="偏酸还是偏甜？下次会怎么调整？"
            maxLength={4000}
          />
          <button
            className="text-button"
            disabled={!noteDirty}
            onClick={() => onSaveNote(draftNote)}
          >
            <Check size={16} />
            保存笔记
          </button>
        </div>
        <div className="recipe-source">
          <BookOpen size={15} />
          <span>
            {recipe.sourceUrl ? (
              <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
                {recipe.sourceLabel || "查看配方来源"}
                <ExternalLink size={12} />
              </a>
            ) : (
              recipe.sourceLabel ||
              (recipe.isCustom ? "个人配方" : "手册收录配方")
            )}
          </span>
        </div>
        <div className="detail-buttons">
          <button
            className="button outline"
            onClick={() => {
              if (allowLeave()) onCopy();
            }}
          >
            <Copy size={17} />
            复制为我的版本
          </button>
          <button
            className="button outline"
            onClick={() => {
              if (allowLeave()) onEdit();
            }}
          >
            <Edit3 size={17} />
            调整配方
          </button>
        </div>
        {isSaved && (
          <button className="delete-button" onClick={onDelete}>
            <Trash2 size={15} />
            {builtInRecipes.some((item) => item.id === recipe.id)
              ? "撤销我的修改，恢复原配方"
              : "删除个人配方"}
          </button>
        )}
      </div>
    </Dialog>
  );
}
const blankIngredient = (): Ingredient => ({
  name: "",
  amount: 30,
  unit: "ml",
  optional: false,
});
function RecipeEditor({
  initial,
  onClose,
  onSave,
}: {
  initial?: Recipe;
  onClose: () => void;
  onSave: (recipe: Recipe) => void;
}) {
  const [recipe, setRecipe] = useState<Recipe>(() =>
    initial
      ? {
          ...initial,
          profile: [...initial.profile],
          ingredients: initial.ingredients.map((item) => ({ ...item })),
          steps: [...initial.steps],
          isCustom: true,
        }
      : {
          id: `custom-${crypto.randomUUID()}`,
          name: "",
          englishName: "",
          era: "特调",
          base: "",
          profile: [],
          description: "",
          ingredients: [blankIngredient()],
          steps: [""],
          glass: "",
          method: "摇和",
          garnish: "",
          strength: 2,
          color: "#bd7655",
          isCustom: true,
          sourceLabel: "个人配方",
        },
  );
  const [profileText, setProfileText] = useState(recipe.profile.join("、"));
  const [error, setError] = useState("");
  const original = useRef(JSON.stringify({ recipe, profileText }));
  const dirty = JSON.stringify({ recipe, profileText }) !== original.current;
  const close = () => {
    if (!dirty || window.confirm("配方还没有保存，确定放弃修改？")) onClose();
  };
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const update = <K extends keyof Recipe>(key: K, value: Recipe[K]) =>
    setRecipe((current) => ({ ...current, [key]: value }));
  const updateIngredient = <K extends keyof Ingredient>(
    index: number,
    key: K,
    value: Ingredient[K],
  ) =>
    update(
      "ingredients",
      recipe.ingredients.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const ingredients = recipe.ingredients.filter((item) => item.name.trim());
    const steps = recipe.steps.map((item) => item.trim()).filter(Boolean);
    if (!recipe.name.trim() || !ingredients.length || !steps.length) {
      setError("请填写配方名称、至少一种原料和一个调制步骤。");
      return;
    }
    if (
      ingredients.some(
        (item) =>
          !Number.isFinite(item.amount) ||
          item.amount <= 0 ||
          !item.unit.trim(),
      )
    ) {
      setError("每种原料都需要大于 0 的份量，以及单位。");
      return;
    }
    if (
      (recipe.era === "无酒精" || recipe.strength === 0) &&
      (recipe.strength !== 0 ||
        ingredients.some((item) => isAlcoholicIngredient(item.name)))
    ) {
      setError(
        "无酒精配方需选择无酒精强度，并移除含酒精原料；若使用无酒精替代品，请在原料名称中注明。",
      );
      return;
    }
    if (recipe.sourceUrl && !/^https?:\/\//.test(recipe.sourceUrl)) {
      setError("来源链接需要以 https:// 或 http:// 开头。");
      return;
    }
    onSave({
      ...recipe,
      sourceUrl: recipe.sourceUrl?.trim() || undefined,
      name: recipe.name.trim(),
      base: recipe.base.trim() || (recipe.strength === 0 ? "无酒精" : "自定义"),
      method: recipe.method.trim() || "按步骤调制",
      profile: [
        ...new Set(
          profileText
            .split(/[、,，/]/)
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ],
      ingredients: ingredients.map((item) => ({
        ...item,
        name: item.name.trim(),
        unit: item.unit.trim(),
      })),
      steps,
      isCustom: true,
      sourceLabel:
        initial && !initial.isCustom
          ? `个人改编 · ${(initial.sourceLabel || "内置配方").replace("（已核对）", "")}`
          : recipe.sourceLabel || "个人配方",
    });
  };
  return (
    <Dialog
      label={initial ? "编辑配方" : "新建配方"}
      className="editor-sheet"
      onClose={close}
    >
      <form onSubmit={submit}>
        <header className="editor-header">
          <button
            type="button"
            className="icon-button"
            onClick={close}
            aria-label="关闭配方编辑"
          >
            <X size={20} />
          </button>
          <div>
            <span className="small-label">WRITE YOUR OWN</span>
            <h2>{initial ? "调整这一杯" : "写下你的新配方"}</h2>
          </div>
          <button className="button primary" type="submit">
            保存
          </button>
        </header>
        <div className="editor-content">
          <p className="editor-lead">
            从喜欢的比例开始。你做的每一次微调，都值得留下来。
          </p>
          <Field label="配方名称" required>
            <input
              value={recipe.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="例如：午夜花园"
              maxLength={100}
            />
          </Field>
          <Field label="英文名称">
            <input
              value={recipe.englishName}
              onChange={(event) => update("englishName", event.target.value)}
              placeholder="可选"
            />
          </Field>
          <div className="field-grid">
            <Field label="分类">
              <select
                value={recipe.era}
                onChange={(event) => {
                  const era = event.target.value as Recipe["era"];
                  setRecipe((current) => ({
                    ...current,
                    era,
                    strength: era === "无酒精" ? 0 : current.strength,
                  }));
                }}
              >
                {["经典", "现代", "无酒精", "特调"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="基酒">
              <input
                value={recipe.base}
                onChange={(event) => update("base", event.target.value)}
                placeholder="金酒 / 无酒精"
              />
            </Field>
          </div>
          <Field label="风味标签">
            <input
              value={profileText}
              onChange={(event) => setProfileText(event.target.value)}
              placeholder="酸甜、花香、清爽（用逗号分开）"
            />
          </Field>
          <Field label="风味与介绍">
            <textarea
              rows={3}
              value={recipe.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="描述香气、口感，以及这杯的灵感。"
            />
          </Field>
          <SectionHeading title="材料与份量">
            <button
              type="button"
              className="text-button"
              onClick={() =>
                update("ingredients", [
                  ...recipe.ingredients,
                  blankIngredient(),
                ])
              }
            >
              <Plus size={16} />
              添加材料
            </button>
          </SectionHeading>
          <div className="ingredient-editor">
            {recipe.ingredients.map((item, index) => (
              <div key={index}>
                <div className="ingredient-input-row">
                  <input
                    aria-label={`材料 ${index + 1} 名称`}
                    value={item.name}
                    onChange={(event) =>
                      updateIngredient(index, "name", event.target.value)
                    }
                    placeholder="原料名称"
                  />
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    aria-label={`材料 ${index + 1} 份量`}
                    disabled={item.unit === "适量"}
                    value={item.amount}
                    onChange={(event) =>
                      updateIngredient(
                        index,
                        "amount",
                        Number(event.target.value),
                      )
                    }
                  />
                  <input
                    aria-label={`材料 ${index + 1} 单位`}
                    value={item.unit}
                    onChange={(event) =>
                      updateIngredient(index, "unit", event.target.value)
                    }
                    placeholder="ml"
                  />
                  <button
                    type="button"
                    aria-label={`删除材料 ${index + 1}`}
                    onClick={() =>
                      update(
                        "ingredients",
                        recipe.ingredients.filter(
                          (_, currentIndex) => currentIndex !== index,
                        ),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <label className="optional-checkbox">
                  <input
                    type="checkbox"
                    checked={!!item.optional}
                    onChange={(event) =>
                      updateIngredient(index, "optional", event.target.checked)
                    }
                  />
                  可选材料 / 装饰
                </label>
              </div>
            ))}
          </div>
          <div className="field-grid">
            <Field label="杯型">
              <input
                value={recipe.glass}
                onChange={(event) => update("glass", event.target.value)}
                placeholder="古典杯"
              />
            </Field>
            <Field label="调制技法">
              <input
                value={recipe.method}
                onChange={(event) => update("method", event.target.value)}
                placeholder="摇和"
              />
            </Field>
          </div>
          <Field label="装饰">
            <input
              value={recipe.garnish}
              onChange={(event) => update("garnish", event.target.value)}
              placeholder="例如：柠檬皮"
            />
          </Field>
          <div className="field-grid">
            <Field label="酒精强度">
              <select
                value={recipe.strength}
                onChange={(event) =>
                  update(
                    "strength",
                    Number(event.target.value) as Recipe["strength"],
                  )
                }
              >
                {[0, 1, 2, 3].map((item) => (
                  <option key={item} value={item}>
                    {strengthLabel(item as Recipe["strength"])}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="酒液颜色">
              <input
                type="color"
                value={recipe.color}
                onChange={(event) => update("color", event.target.value)}
              />
            </Field>
          </div>
          <SectionHeading title="调制步骤">
            <button
              type="button"
              className="text-button"
              onClick={() => update("steps", [...recipe.steps, ""])}
            >
              <Plus size={16} />
              添加步骤
            </button>
          </SectionHeading>
          <div className="step-editor">
            {recipe.steps.map((step, index) => (
              <div key={index}>
                <span>{index + 1}</span>
                <textarea
                  aria-label={`调制步骤 ${index + 1}`}
                  rows={2}
                  value={step}
                  onChange={(event) =>
                    update(
                      "steps",
                      recipe.steps.map((item, currentIndex) =>
                        currentIndex === index ? event.target.value : item,
                      ),
                    )
                  }
                  placeholder="描述这一步的做法"
                />
                <button
                  type="button"
                  aria-label={`删除步骤 ${index + 1}`}
                  onClick={() =>
                    update(
                      "steps",
                      recipe.steps.filter(
                        (_, currentIndex) => currentIndex !== index,
                      ),
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="field-grid source-fields">
            <Field label="配方来源">
              <input
                value={recipe.sourceLabel || ""}
                onChange={(event) => update("sourceLabel", event.target.value)}
                placeholder="个人配方 / 参考书目"
              />
            </Field>
            <Field label="来源链接">
              <input
                value={recipe.sourceUrl || ""}
                onChange={(event) => update("sourceUrl", event.target.value)}
                placeholder="https://…（可选）"
              />
            </Field>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary editor-submit" type="submit">
            <Check size={18} />
            保存到我的手册
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  const control = isValidElement<{ "aria-label"?: string }>(children)
    ? cloneElement(children, { "aria-label": label })
    : children;
  return (
    <label className="field">
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      {control}
    </label>
  );
}
const PROVIDERS = [
  {
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
  {
    name: "DeepSeek",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
  },
  {
    name: "Moonshot Kimi",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    model: "moonshot-v1-8k",
  },
  {
    name: "智谱 GLM",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4-flash",
  },
  {
    name: "通义千问",
    endpoint:
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: "qwen-plus",
  },
  {
    name: "SiliconFlow",
    endpoint: "https://api.siliconflow.cn/v1/chat/completions",
    model: "deepseek-ai/DeepSeek-V3",
  },
  { name: "自定义", endpoint: "", model: "" },
];
function ApiSettingsSheet({
  initial,
  onClose,
  onSave,
}: {
  initial: ApiSettings;
  onClose: () => void;
  onSave: (settings: ApiSettings, tested: boolean) => void;
}) {
  const [value, setValue] = useState(initial);
  const [provider, setProvider] = useState(
    PROVIDERS.find((item) => item.endpoint === initial.endpoint)?.name ||
      "自定义",
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const testController = useRef<AbortController | null>(null);
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);
  const close = () => {
    if (testing) testController.current?.abort();
    if (!dirty || window.confirm("API 设置还没有保存，确定关闭？")) onClose();
  };
  useEffect(() => () => testController.current?.abort(), []);
  const update = (next: ApiSettings) => {
    setValue(next);
    setTestResult(null);
  };
  const applyProvider = (name: string) => {
    const next = PROVIDERS.find((item) => item.name === name);
    if (!next) return;
    setProvider(name);
    update({ endpoint: next.endpoint, model: next.model, apiKey: "" });
  };
  const updateEndpoint = (endpoint: string) => {
    let domainChanged = false;
    try {
      domainChanged =
        new URL(endpoint).origin !== new URL(value.endpoint).origin;
    } catch {
      domainChanged = endpoint !== value.endpoint;
    }
    setProvider("自定义");
    update({ ...value, endpoint, apiKey: domainChanged ? "" : value.apiKey });
  };
  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const requestController = new AbortController();
    testController.current = requestController;
    try {
      const result = await testConnection(value, requestController.signal);
      if (!requestController.signal.aborted) setTestResult(result);
    } catch (error) {
      if (!requestController.signal.aborted)
        setTestResult({
          ok: false,
          detail: error instanceof Error ? error.message : "连接测试失败",
        });
    } finally {
      setTesting(false);
    }
  };
  return (
    <Dialog label="对话 API 设置" className="api-sheet" onClose={close}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(
            {
              ...value,
              endpoint: value.endpoint.trim(),
              apiKey: value.apiKey.trim(),
              model: value.model.trim(),
            },
            !!testResult?.ok,
          );
        }}
      >
        <header className="editor-header">
          <button
            type="button"
            className="icon-button"
            onClick={close}
            aria-label="关闭对话设置"
          >
            <X size={20} />
          </button>
          <div>
            <span className="small-label">CONNECT YOUR BARTENDER</span>
            <h2>对话设置</h2>
          </div>
          <KeyRound size={21} />
        </header>
        <div className="editor-content">
          <p className="editor-lead">
            连接 OpenAI 兼容接口，开启自由对话。没有密钥也可以使用离线配方推荐。
          </p>
          <Field label="提供商">
            <select
              value={provider}
              onChange={(event) => applyProvider(event.target.value)}
              disabled={testing}
            >
              {PROVIDERS.map((item) => (
                <option key={item.name}>{item.name}</option>
              ))}
            </select>
          </Field>
          <Field label="接口地址">
            <input
              type="url"
              required
              value={value.endpoint}
              onChange={(event) => updateEndpoint(event.target.value)}
              placeholder="https://…/chat/completions"
              disabled={testing}
            />
          </Field>
          <Field label="模型名称">
            <input
              required
              value={value.model}
              onChange={(event) =>
                update({ ...value, model: event.target.value })
              }
              placeholder="填写服务商提供的模型名称"
              disabled={testing}
            />
          </Field>
          <Field label="API 密钥">
            <input
              type="password"
              autoComplete="off"
              value={value.apiKey}
              onChange={(event) =>
                update({ ...value, apiKey: event.target.value })
              }
              placeholder="留空使用离线推荐"
              disabled={testing}
            />
          </Field>
          <p className="settings-note">
            切换提供商或接口域名时会清空密钥，请填写对应平台的密钥。密钥保存在本机，导出备份时不会包含。
          </p>
          <button
            type="button"
            className="button outline test-button"
            disabled={
              testing ||
              !value.apiKey.trim() ||
              !value.endpoint.trim() ||
              !value.model.trim()
            }
            onClick={runTest}
          >
            {testing ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <FlaskConical size={17} />
            )}
            {testing ? "正在测试连接…" : "测试连接"}
          </button>
          {testResult && (
            <div
              className={`test-result ${testResult.ok ? "ok" : "fail"}`}
              role="status"
            >
              {testResult.detail}
            </div>
          )}
          <button
            type="submit"
            className="button primary editor-submit"
            disabled={testing}
          >
            保存设置
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Search;
  title: string;
  text: string;
}) {
  return (
    <div className="empty">
      <span>
        <Icon size={27} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export default App;
