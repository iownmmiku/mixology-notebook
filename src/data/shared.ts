import type { Ingredient, Recipe } from '../types';

export type Seed = Omit<Recipe, 'color'> & { color?: string };

export const i = (name: string, amount: number, unit = 'ml', optional = false): Ingredient => ({ name, amount, unit, optional });

export const make = (seed: Seed, index: number): Recipe => ({ ...seed, color: seed.color ?? COLORS[index % COLORS.length] });

export const COLORS = ['#c86b3c', '#d5a33f', '#8e6f48', '#b9473f', '#527f6f', '#a35d77', '#607d9a'];
