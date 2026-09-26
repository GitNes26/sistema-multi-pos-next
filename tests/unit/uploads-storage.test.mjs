import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { uploadsRoot, uploadedFileCandidates, uploadedFilePath } from "../../src/lib/uploads/storage.ts"

test("aísla las cargas dentro de la carpeta del proyecto", () => {
  const previousDir = process.env.UPLOADS_DIR
  const previousProject = process.env.UPLOADS_PROJECT
  process.env.UPLOADS_DIR = path.join("tmp", "shared-uploads")
  process.env.UPLOADS_PROJECT = "multi-pos"
  try {
    assert.equal(uploadsRoot(), path.join("tmp", "shared-uploads", "multi-pos"))
    assert.equal(uploadedFilePath("org_1", "image-1.webp"), path.join("tmp", "shared-uploads", "multi-pos", "org_1", "image-1.webp"))
    assert.deepEqual(uploadedFileCandidates("org_1", "image-1.webp"), [
      path.join("tmp", "shared-uploads", "multi-pos", "org_1", "image-1.webp"),
      path.join("tmp", "shared-uploads", "org_1", "image-1.webp"),
    ])
  } finally {
    if (previousDir === undefined) delete process.env.UPLOADS_DIR
    else process.env.UPLOADS_DIR = previousDir
    if (previousProject === undefined) delete process.env.UPLOADS_PROJECT
    else process.env.UPLOADS_PROJECT = previousProject
  }
})

test("rechaza nombres de proyecto que intenten salir del volumen", () => {
  const previous = process.env.UPLOADS_PROJECT
  process.env.UPLOADS_PROJECT = "../otro-proyecto"
  try {
    assert.throws(() => uploadsRoot(), /UPLOADS_PROJECT/)
  } finally {
    if (previous === undefined) delete process.env.UPLOADS_PROJECT
    else process.env.UPLOADS_PROJECT = previous
  }
})
