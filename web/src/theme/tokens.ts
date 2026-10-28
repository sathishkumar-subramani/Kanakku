import tokens from './tokens.json'
import type { Category } from '@/api/types'

export interface CategoryMeta {
  label: string
  emoji: string
  color: string
}

export const CATEGORIES = tokens.categories as Record<Category, CategoryMeta>
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[]
export const AVATAR_PALETTE: string[] = tokens.avatarPalette
export const GROUP_PALETTE: string[] = tokens.groupPalette
export const GROUP_EMOJIS: string[] = tokens.groupEmojis
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'] as const

export function categoryMeta(category: string): CategoryMeta {
  return CATEGORIES[category as Category] ?? CATEGORIES.other
}
