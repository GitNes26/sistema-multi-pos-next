export function parseRecipeVariantSelections(valueIds: Iterable<string>) {
  const selections = new Map<string, string>()
  for (const valueId of valueIds) {
    if (!valueId.startsWith("recipevar:")) continue
    const [, recipeId, variantId] = valueId.split(":")
    if (recipeId && variantId) selections.set(recipeId, variantId)
  }
  return selections
}

export function resolveRecipeIngredientVariant(
  recipeId: string,
  candidateIds: string[],
  selections: ReadonlyMap<string, string>
) {
  const selectedId = selections.get(recipeId)
  if (selectedId) {
    if (!candidateIds.includes(selectedId))
      throw new Error("La variante elegida para un insumo ya no está disponible")
    return selectedId
  }
  if (candidateIds.length === 1) return candidateIds[0]
  if (candidateIds.length > 1)
    throw new Error("Selecciona la variante del insumo antes de completar la venta")
  return null
}
