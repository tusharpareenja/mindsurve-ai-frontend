import type { ApiDesignConstraint } from "@/lib/utils/designConstraintsStorage"

export const TOP_MIX_COUNT = 5
const MAX_NON_LAYER_SELECTIONS = 4
const NON_LAYER_CATEGORY_POOL = 12
const SEARCH_BUDGET = 25000

export type MixElement = {
  id: string
  name: string
  value: number
  layerId?: string
  imageId?: string
}

export type MixCategory = {
  key: string
  name: string
  zIndex: number
  elements: MixElement[]
}

export type RankedMix = {
  rank: number
  score: number
  selection: Record<string, string>
  labels: string[]
}

type SortedGroup = {
  category: MixCategory
  elements: MixElement[]
}

export function mixSignature(selection: Record<string, string>): string {
  return Object.keys(selection)
    .sort()
    .map((key) => `${key}=${selection[key]}`)
    .join("|")
}

function constraintRefKey(ref: { layer_id?: string; image_id?: string; layerId?: string; imageId?: string }): string | null {
  const layerId = String(ref.layer_id ?? ref.layerId ?? "").trim()
  const imageId = String(ref.image_id ?? ref.imageId ?? "").trim()
  return layerId && imageId ? `${layerId}::${imageId}` : null
}

function elementConstraintKey(element: MixElement): string | null {
  return element.layerId && element.imageId ? `${element.layerId}::${element.imageId}` : null
}

function buildConflictPairSet(designConstraints: ApiDesignConstraint[]): Set<string> {
  const pairs = new Set<string>()
  designConstraints.forEach((constraint) => {
    const anchors = Array.isArray(constraint.anchors) ? constraint.anchors : []
    const blocked = Array.isArray(constraint.blocked) ? constraint.blocked : []
    anchors.forEach((anchor) => {
      const anchorKey = constraintRefKey(anchor)
      if (!anchorKey) return
      blocked.forEach((blockedRef) => {
        const blockedKey = constraintRefKey(blockedRef)
        if (!blockedKey || blockedKey === anchorKey) return
        pairs.add(`${anchorKey}|${blockedKey}`)
        pairs.add(`${blockedKey}|${anchorKey}`)
      })
    })
  })
  return pairs
}

function conflictsWithSelected(element: MixElement, selected: MixElement[], conflictPairs: Set<string>): boolean {
  const elementKey = elementConstraintKey(element)
  if (!elementKey) return false
  return selected.some((item) => {
    const selectedKey = elementConstraintKey(item)
    return Boolean(selectedKey && conflictPairs.has(`${elementKey}|${selectedKey}`))
  })
}

function sortElements(elements: MixElement[]): MixElement[] {
  return [...elements].sort((a, b) => b.value - a.value)
}

function toRanked(groups: SortedGroup[], selection: Record<string, string>, score: number, rank: number): RankedMix {
  const labels = groups
    .map((group) => group.elements.find((element) => element.id === selection[group.category.key])?.name)
    .filter((name): name is string => Boolean(name))
  return { rank, score, selection: { ...selection }, labels }
}

function rankFixedCategoryMixes(groups: SortedGroup[], limit: number): RankedMix[] {
  if (groups.length === 0 || groups.some((group) => group.elements.length === 0)) return []

  const scoreOf = (ranks: number[]) =>
    ranks.reduce((sum, rankIndex, index) => sum + groups[index].elements[rankIndex].value, 0)

  const startRanks = groups.map(() => 0)
  const heap: { score: number; ranks: number[] }[] = [{ score: scoreOf(startRanks), ranks: startRanks }]
  const seen = new Set<string>([startRanks.join(",")])
  const chosen: { score: number; ranks: number[] }[] = []

  const popMax = () => {
    let bestIndex = 0
    for (let index = 1; index < heap.length; index += 1) {
      if (heap[index].score > heap[bestIndex].score) bestIndex = index
    }
    return heap.splice(bestIndex, 1)[0]
  }

  while (heap.length > 0 && chosen.length < limit) {
    const node = popMax()
    chosen.push(node)
    for (let index = 0; index < groups.length; index += 1) {
      if (node.ranks[index] + 1 >= groups[index].elements.length) continue
      const next = node.ranks.slice()
      next[index] += 1
      const key = next.join(",")
      if (seen.has(key)) continue
      seen.add(key)
      heap.push({ score: scoreOf(next), ranks: next })
    }
  }

  return chosen.map((node, index) => {
    const selection: Record<string, string> = {}
    node.ranks.forEach((rankIndex, groupIndex) => {
      selection[groups[groupIndex].category.key] = groups[groupIndex].elements[rankIndex].id
    })
    return toRanked(groups, selection, node.score, index + 1)
  })
}

function rankNonLayerMixes(categories: MixCategory[], limit: number): RankedMix[] {
  const ranked = categories
    .map((category) => ({ category, elements: sortElements(category.elements) }))
    .filter((group) => group.elements.length > 0)
    .sort((a, b) => b.elements[0].value - a.elements[0].value)

  const target = Math.min(MAX_NON_LAYER_SELECTIONS, ranked.length)
  if (target === 0) return []
  const pool = ranked.slice(0, Math.min(ranked.length, Math.max(NON_LAYER_CATEGORY_POOL, target)))
  const bestValues = pool.map((group) => group.elements[0].value)

  const optimistic = (start: number, need: number) => {
    if (need <= 0 || start >= bestValues.length) return 0
    let sum = 0
    const end = Math.min(bestValues.length, start + need)
    for (let index = start; index < end; index += 1) sum += bestValues[index]
    return sum
  }

  type Found = { score: number; selection: Record<string, string>; order: number }
  const found: Found[] = []
  let worst = Number.NEGATIVE_INFINITY
  let explored = 0
  let order = 0

  const consider = (selection: Record<string, string>, score: number) => {
    if (found.length < limit) {
      found.push({ score, selection: { ...selection }, order: order += 1 })
      if (found.length === limit) {
        found.sort((a, b) => a.score - b.score || b.order - a.order)
        worst = found[0].score
      }
      return
    }
    if (score <= worst) return
    found[0] = { score, selection: { ...selection }, order: order += 1 }
    found.sort((a, b) => a.score - b.score || b.order - a.order)
    worst = found[0].score
  }

  const search = (start: number, chosen: number, selection: Record<string, string>, score: number) => {
    const need = target - chosen
    if (need === 0) {
      consider(selection, score)
      return
    }
    explored += 1
    if (explored > SEARCH_BUDGET) return
    if (start >= pool.length || pool.length - start < need) return
    if (found.length >= limit && score + optimistic(start, need) <= worst) return

    for (let index = start; index <= pool.length - need; index += 1) {
      if (found.length >= limit && score + optimistic(index, need) <= worst) break
      const group = pool[index]
      for (let rankIndex = 0; rankIndex < group.elements.length; rankIndex += 1) {
        const element = group.elements[rankIndex]
        const nextScore = score + element.value
        if (found.length >= limit && nextScore + optimistic(index + 1, need - 1) <= worst) break
        selection[group.category.key] = element.id
        search(index + 1, chosen + 1, selection, nextScore)
        delete selection[group.category.key]
        if (explored > SEARCH_BUDGET) return
      }
    }
  }

  search(0, 0, {}, 0)
  found.sort((a, b) => b.score - a.score || a.order - b.order)
  return found.slice(0, limit).map((item, index) => toRanked(pool, item.selection, item.score, index + 1))
}

function rankConstrainedLayerMixes(
  categories: MixCategory[],
  designConstraints: ApiDesignConstraint[],
  limit: number
): RankedMix[] {
  const conflictPairs = buildConflictPairSet(designConstraints)
  const conflictDegree = (category: MixCategory) =>
    category.elements.reduce((count, element) => {
      const key = elementConstraintKey(element)
      if (!key) return count
      for (const pair of conflictPairs) {
        if (pair.startsWith(`${key}|`)) count += 1
      }
      return count
    }, 0)

  const layerCategories = [...categories]
    .filter((category) => category.elements.length > 0)
    .sort((a, b) => {
      const degreeDelta = conflictDegree(b) - conflictDegree(a)
      if (degreeDelta !== 0) return degreeDelta
      const sizeDelta = a.elements.length - b.elements.length
      if (sizeDelta !== 0) return sizeDelta
      return a.zIndex - b.zIndex
    })
    .map((category) => ({ category, elements: sortElements(category.elements) }))

  if (layerCategories.length === 0) return []

  const suffixBest = new Array(layerCategories.length + 1).fill(0)
  for (let index = layerCategories.length - 1; index >= 0; index -= 1) {
    suffixBest[index] = suffixBest[index + 1] + Math.max(0, layerCategories[index].elements[0]?.value ?? 0)
  }

  type Found = { score: number; selection: Record<string, string>; order: number }
  const found: Found[] = []
  let worst = Number.NEGATIVE_INFINITY
  let explored = 0
  let order = 0

  const consider = (selection: Record<string, string>, score: number) => {
    if (Object.keys(selection).length === 0) return
    if (found.length < limit) {
      found.push({ score, selection: { ...selection }, order: order += 1 })
      if (found.length === limit) {
        found.sort((a, b) => a.score - b.score || b.order - a.order)
        worst = found[0].score
      }
      return
    }
    if (score <= worst) return
    found[0] = { score, selection: { ...selection }, order: order += 1 }
    found.sort((a, b) => a.score - b.score || b.order - a.order)
    worst = found[0].score
  }

  const search = (
    index: number,
    selectedElements: MixElement[],
    selectedByCategory: Record<string, string>,
    score: number
  ) => {
    if (found.length >= limit && score + suffixBest[index] <= worst) return
    if (index === layerCategories.length) {
      consider(selectedByCategory, score)
      return
    }
    explored += 1
    if (explored > SEARCH_BUDGET) return

    const { category, elements } = layerCategories[index]
    for (const element of elements) {
      if (conflictsWithSelected(element, selectedElements, conflictPairs)) continue
      selectedByCategory[category.key] = element.id
      selectedElements.push(element)
      search(index + 1, selectedElements, selectedByCategory, score + element.value)
      selectedElements.pop()
      delete selectedByCategory[category.key]
      if (explored > SEARCH_BUDGET) return
    }
    search(index + 1, selectedElements, selectedByCategory, score)
  }

  search(0, [], {}, 0)
  found.sort((a, b) => b.score - a.score || a.order - b.order)
  return found.slice(0, limit).map((item, index) => toRanked(layerCategories, item.selection, item.score, index + 1))
}

export function rankConfiguratorMixes(input: {
  categories: MixCategory[]
  isLayer: boolean
  designConstraints?: ApiDesignConstraint[]
  limit?: number
}): RankedMix[] {
  const limit = Math.max(1, Math.min(input.limit ?? TOP_MIX_COUNT, TOP_MIX_COUNT))
  const categories = input.categories.filter((category) => category.elements.length > 0)
  if (categories.length === 0) return []

  if (!input.isLayer) return rankNonLayerMixes(categories, limit)

  const constraints = input.designConstraints || []
  if (buildConflictPairSet(constraints).size === 0) {
    const groups = [...categories]
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((category) => ({ category, elements: sortElements(category.elements) }))
    return rankFixedCategoryMixes(groups, limit)
  }
  return rankConstrainedLayerMixes(categories, constraints, limit)
}
