export type Ingredient = {
  name: string;
  amount: number;
  unit: string;
  optional?: boolean;
};

export type Recipe = {
  id: string;
  name: string;
  englishName: string;
  era: '经典' | '现代' | '无酒精' | '特调';
  base: string;
  profile: string[];
  description: string;
  ingredients: Ingredient[];
  steps: string[];
  glass: string;
  method: string;
  garnish: string;
  strength: 0 | 1 | 2 | 3;
  color: string;
  isCustom?: boolean;
};

export type ApiSettings = {
  endpoint: string;
  apiKey: string;
  model: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};
