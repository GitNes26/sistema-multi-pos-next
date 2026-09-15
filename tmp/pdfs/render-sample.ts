import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../src/lib/db";
import { buildBiExportSections } from "../../src/lib/reports/bi-export";
import { buildExecutiveReportPdf } from "../../src/lib/reports/pdf";
async function main(){
 const org=await prisma.organization.findFirst({where:{businessMode:"hybrid"},include:{companyProfile:true,appSettings:true}});if(!org)throw new Error("No hybrid demo organization");
 const sections=await buildBiExportSections(org.id,["omnichannel","table_performance","appointments","rentals"],{});
 let logo:Buffer|null=null;if(org.companyProfile?.logoUrl?.startsWith("/")){try{logo=await readFile(path.join(process.cwd(),"public",org.companyProfile.logoUrl.replace(/^\/+/,"")));}catch{}}
 const pdf=await buildExecutiveReportPdf({organizationName:org.companyProfile?.tradeName||org.name,legalName:org.companyProfile?.legalName,taxId:org.companyProfile?.taxId,logo,address:org.companyProfile?.address,phone:org.companyProfile?.phone,email:org.companyProfile?.email,businessMode:org.businessMode,appearance:org.appSettings?{...org.appSettings,fontScale:Number(org.appSettings.fontScale),borderRadius:Number(org.appSettings.borderRadius)}:null,period:"Inicio - hoy",filters:["Todas las sucursales","Demostración de diseño"],sections});
 await writeFile("output/pdf/bi-professional-sample.pdf",pdf);await prisma.$disconnect();
}
void main();
