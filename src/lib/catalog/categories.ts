export type CategoryNode = { id: string; parentId?: string | null }

/** Devuelve la categoría seleccionada y todos sus descendientes, sin límite de niveles. */
export function categoryBranchIds(categories: CategoryNode[], rootId: string | null | undefined): Set<string> {
  if (!rootId) return new Set()
  const children = new Map<string, string[]>()
  for (const category of categories) {
    if (!category.parentId) continue
    const list = children.get(category.parentId) ?? []
    list.push(category.id)
    children.set(category.parentId, list)
  }
  const result = new Set<string>()
  const pending = [rootId]
  while (pending.length) {
    const id = pending.pop()!
    if (result.has(id)) continue
    result.add(id)
    pending.push(...(children.get(id) ?? []))
  }
  return result
}
