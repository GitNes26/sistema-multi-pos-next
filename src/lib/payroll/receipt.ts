import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { sendBusinessMail } from "@/lib/auth/mail"
import { receiptBodyHtml } from "@/lib/payroll/receipt-html"
import { getPeriod, receiptCompany } from "@/lib/payroll/server"
import { absoluteUrl } from "@/lib/documents/branding"

// Recibo de nómina por correo. Es un comprobante interno: el texto aclara que
// no es un CFDI de nómina.


export async function emailReceipt(organizationId: string, entryId: string) {
  const entry = await prisma.payrollEntry.findFirst({ where: { id: entryId, organizationId }, select: { periodId: true } })
  if (!entry) throw new CrudError("Registro no encontrado", 404)
  const [period, company] = await Promise.all([getPeriod(organizationId, entry.periodId), receiptCompany(organizationId)])
  const e = period.entries.find((x) => x.id === entryId)!
  const to = e.employee.email
  if (!to || to.endsWith("@local.invalid")) throw new CrudError("El empleado no tiene un correo registrado", 400)

  const logo = absoluteUrl(company.logoUrl)
  const html = (logo ? `<img src="${logo}" alt="" style="height:48px;max-width:160px;object-fit:contain;margin:0 0 12px"/>` : "") + receiptBodyHtml(period, e, company)

  await sendBusinessMail(to, `Recibo de nómina ${period.folio} · ${company.name}`, "Recibo de nómina", html, company.name)
  await prisma.payrollEntry.update({ where: { id: entryId }, data: { emailedAt: new Date() } })
  return { ok: true, to }
}
