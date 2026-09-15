"use client"
import { useEffect, useState } from "react"
import { CalendarCheck2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { money } from "@/lib/pos/money"

const CONFIG = {
  table_performance: { title:"Rendimiento de mesas", empty:"No hay sesiones de mesa en este período.", columns:[["tableName","Mesa"],["sessions","Sesiones"],["avgMinutes","Duración promedio"],["revenue","Ingresos"],["avgTicket","Ticket promedio"]] },
  appointments: { title:"Rendimiento de citas", empty:"No hay citas en este período.", columns:[["employeeName","Empleado"],["total","Citas"],["completed","Completadas"],["cancelled","Canceladas"],["noShow","No asistió"],["attendancePct","Atención"],["revenue","Ingresos"]] },
  rentals: { title:"Rendimiento de rentas", empty:"No hay reservaciones en este período.", columns:[["locationName","Sucursal"],["reservations","Reservaciones"],["completed","Completadas"],["cancelled","Canceladas"],["units","Unidades"],["revenue","Ingresos"]] },
} as const
type Kind = keyof typeof CONFIG
export function OperationalReport({ kind, from, to }: { kind:Kind; from:string; to:string }) {
  const [rows,setRows]=useState<Record<string,unknown>[]>([]); const [loading,setLoading]=useState(true); const config=CONFIG[kind]
  useEffect(()=>{const params=new URLSearchParams({report:kind});if(from)params.set("from",from);if(to)params.set("to",to);setLoading(true);fetch(`/api/reports/bi?${params}`).then(r=>r.json()).then(d=>setRows(d.rows??[])).catch(()=>setRows([])).finally(()=>setLoading(false))},[kind,from,to])
  const format=(key:string,value:unknown)=> key.includes("revenue")||key==="avgTicket"?money(Number(value??0)):key.includes("Pct")?`${Number(value??0).toFixed(1)}%`:key==="avgMinutes"?`${value} min`:String(value??"—")
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><CalendarCheck2 className="size-4"/>{config.title}</CardTitle></CardHeader><CardContent>{loading?<p className="py-8 text-center text-muted-foreground">Cargando…</p>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground">{config.columns.map(([,label])=><th key={label} className="whitespace-nowrap px-2 py-2 first:pl-0">{label}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index} className="border-b last:border-0">{config.columns.map(([key])=><td key={key} className="whitespace-nowrap px-2 py-3 first:pl-0 tabular-nums">{format(key,row[key])}</td>)}</tr>)}{!rows.length&&<tr><td colSpan={config.columns.length} className="py-10 text-center text-muted-foreground">{config.empty}</td></tr>}</tbody></table></div>}</CardContent></Card>
}
