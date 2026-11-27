import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/auth/permissions"
import { prisma } from "@/lib/db"
import { saveCustomPlan, subscriptionUsage, syncExpiredSubscriptions } from "@/lib/billing/subscriptions"
import { demoPeriodEnd } from "@/lib/billing/demo"
import { parseBillingMonths, resolveBillingDate } from "@/lib/billing/periods"

export async function GET() {
 const session = await getServerSession(authOptions); if (!session?.user) return NextResponse.json({ok:false,error:"No autorizado"},{status:401})
 await syncExpiredSubscriptions()
 if (hasPermission(session,"organizations.manage")) {
  const organizations = await prisma.organization.findMany({ include: { subscription: { include: { plan: true } }, subscriptionPayments: { orderBy: { createdAt: "desc" }, take: 20 }, _count: { select: { locations: true, employees: true } } }, orderBy: { name: "asc" } })
  return NextResponse.json({ok:true,organizations})
 }
 const organizationId=effectiveOrgId(session); if(!organizationId) return NextResponse.json({ok:false,error:"Selecciona una empresa"},{status:400})
 return NextResponse.json({ok:true,usage:await subscriptionUsage(organizationId),payments:await prisma.subscriptionPayment.findMany({where:{organizationId},orderBy:{createdAt:"desc"},take:20})})
}
export async function POST(request:Request){
 const session=await getServerSession(authOptions); if(!hasPermission(session,"organizations.manage")) return NextResponse.json({ok:false,error:"Solo el superadministrador puede modificar suscripciones"},{status:403})
 try { const body=await request.json(); const organizationId=String(body.organizationId??"");
  if(body.action==="payment") {
   const current=await prisma.organizationSubscription.findUnique({where:{organizationId},select:{isDemo:true}})
   if(current?.isDemo) return NextResponse.json({ok:false,error:"Es una empresa demo: no se cobra. Desactiva «Demo» al contratar para registrar su primer pago."},{status:409})
   const payment=await prisma.subscriptionPayment.create({data:{organizationId,subscriptionId:body.subscriptionId||null,planId:body.planId||null,amount:Number(body.amount),status:"paid",paidAt:new Date(),reference:String(body.reference??"")||null}}); if(body.subscriptionId) await prisma.organizationSubscription.update({where:{id:String(body.subscriptionId)},data:{status:"active"}}); await prisma.organization.update({where:{id:organizationId},data:{isBlocked:false,blockedReason:null}}); return NextResponse.json({ok:true,payment}) }
  // Plan Personalizado: se arma un plan propio de la empresa y los extras no aplican.
  const isCustomPlan=body.planId==="custom"
  const planId=isCustomPlan?await saveCustomPlan(organizationId,body.custom??{}):String(body.planId)
  const extraLocations=isCustomPlan?0:Math.max(0,Number(body.extraLocations??0)); const extraEmployeePacks=isCustomPlan?0:Math.max(0,Number(body.extraEmployeePacks??0))
  const isDemo=body.isDemo===true
  // En demo, «días de prueba» fija el fin de la prueba a partir de hoy.
  const current=await prisma.organizationSubscription.findUnique({where:{organizationId},select:{periodStartsAt:true,periodEndsAt:true}})
  const periodEndsAt=isDemo&&Number(body.demoDays)>0?demoPeriodEnd(Number(body.demoDays)):resolveBillingDate(body.periodEndsAt,current?.periodEndsAt,"end"); if(!periodEndsAt) throw new Error("Selecciona una fecha de vencimiento válida")
  // Inicio y frecuencia son opcionales: si no llegan, se conserva lo guardado.
  const periodStartsAt=body.periodStartsAt?resolveBillingDate(body.periodStartsAt,current?.periodStartsAt):undefined; if(periodStartsAt===null) throw new Error("Selecciona una fecha de inicio válida")
  const billingMonths=body.billingMonths===undefined?undefined:parseBillingMonths(body.billingMonths)
  // El orden solo se exige al cambiar alguna fecha (no bloquea registros previos sin tocar).
  const start=periodStartsAt??current?.periodStartsAt; const datesChanged=periodEndsAt!==current?.periodEndsAt||(periodStartsAt!==undefined&&periodStartsAt!==current?.periodStartsAt)
  if(!isDemo&&datesChanged&&start&&periodEndsAt.toISOString().slice(0,10)<start.toISOString().slice(0,10)) throw new Error("El vencimiento no puede ser anterior al inicio de la suscripción")
  const subscription=await prisma.organizationSubscription.upsert({where:{organizationId},update:{planId,status:String(body.status??"active"),periodStartsAt,periodEndsAt,billingMonths,graceEndsAt:body.graceEndsAt?new Date(body.graceEndsAt):null,extraLocations,extraEmployeePacks,autoBlockOnPastDue:body.autoBlockOnPastDue!==false,isDemo,reminderDaysBefore:Math.max(0,Number(body.reminderDaysBefore??5))},create:{organizationId,planId,periodStartsAt,periodEndsAt,billingMonths,isDemo,status:String(body.status??"active"),extraLocations,extraEmployeePacks}})
  const blocked=body.blocked===true; await prisma.organization.update({where:{id:organizationId},data:{isBlocked:blocked,blockedReason:blocked?String(body.blockedReason??"Cuenta suspendida por administración"):null}}); return NextResponse.json({ok:true,subscription})
 } catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"No fue posible actualizar la suscripción"},{status:400})}
}
