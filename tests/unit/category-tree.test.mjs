import test from "node:test"
import assert from "node:assert/strict"
import { categoryBranchIds } from "../../src/lib/catalog/categories.ts"

const categories = [
  { id: "food", parentId: null },
  { id: "snacks", parentId: "food" },
  { id: "chips", parentId: "snacks" },
  { id: "drinks", parentId: null },
  { id: "soda", parentId: "drinks" },
]

test("a parent category includes every descendant level", () => {
  assert.deepEqual(
    [...categoryBranchIds(categories, "food")].sort(),
    ["chips", "food", "snacks"]
  )
})

test("a child category does not include parents or sibling branches", () => {
  assert.deepEqual([...categoryBranchIds(categories, "snacks")].sort(), ["chips", "snacks"])
})

test("category traversal remains finite when imported data contains a cycle", () => {
  const cyclic = [
    { id: "a", parentId: "b" },
    { id: "b", parentId: "a" },
  ]
  assert.deepEqual([...categoryBranchIds(cyclic, "a")].sort(), ["a", "b"])
})
