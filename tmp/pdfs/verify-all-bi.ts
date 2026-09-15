import { prisma } from "../../src/lib/db";
import { reportsForMode } from "../../src/lib/reports/bi-catalog";
import { buildBiExportSections } from "../../src/lib/reports/bi-export";
async function main(){for(const mode of ["retail","food_service","services","rental","hybrid"] as const){const org=await prisma.organization.findFirst({where:{businessMode:mode}});if(!org)continue;const ids=reportsForMode(mode).map(r=>r.id);const sections=await buildBiExportSections(org.id,ids,{});if(sections.length!==ids.length)throw new Error(`${mode}: ${sections.length}/${ids.length}`);console.log(`${mode}: ${sections.length} reportes`)}await prisma.$disconnect()}void main();
