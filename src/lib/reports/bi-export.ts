import { BI_REPORTS, type BiReportId } from "./bi-catalog"
import type { ExecutiveReportSection } from "./pdf"
import * as bi from "./bi-server"

type Filters = { from?:string; to?:string; locationId?:string }
const LABELS:Record<string,string>={locationName:"Sucursal",posSales:"Ventas POS",portalSales:"Ventas portal",total:"Total",pctWeb:"% web",aovPos:"Ticket POS",aovPortal:"Ticket portal",categoryName:"Categoría",valueAtCost:"Valor a costo",valueAtRetail:"Valor a venta",productCount:"Productos",outOfStock:"Sin stock",productName:"Producto",quantity:"Unidades",revenue:"Ingresos",margin:"Margen",marginPct:"Margen %",employeeName:"Empleado",totalSales:"Ventas",avgTicket:"Ticket promedio",saleCount:"Transacciones",totalUnits:"Unidades",customerName:"Cliente",totalPoints:"Puntos",totalSpent:"Gasto",orderCount:"Pedidos",lastOrderDate:"Último pedido",balance:"Saldo",creditLimit:"Límite",daysOverdue:"Días vencidos",agingBucket:"Antigüedad",promotionName:"Promoción",discountGiven:"Descuento",revenueGenerated:"Ingreso generado",ordersCount:"Pedidos",roi:"ROI %",totalOrders:"Pedidos",avgPrepMinutes:"Preparación min",avgDeliveryMinutes:"Entrega min",onTimeRate:"A tiempo %",cancelRate:"Cancelación %",currentStock:"Existencia",minStock:"Mínimo",deficit:"Déficit",segment:"Segmento",customerCount:"Clientes",avgSpent:"Gasto promedio",costOfGoods:"Costo",date:"Fecha",method:"Método",count:"Operaciones",pct:"Participación %",productA:"Producto A",productB:"Producto B",timesTogether:"Coincidencias",avgRevenue:"Ingreso promedio",fromLocation:"Origen",toLocation:"Destino",status:"Estado",itemCount:"Partidas",totalQty:"Cantidad",createdAt:"Fecha",totalProducts:"Productos",inStock:"Con stock",fillRate:"Disponibilidad %",totalRevenue:"Ingresos",totalCost:"Costo",predictedSales:"Venta prevista",confidence:"Confianza %",sampleSize:"Muestras",tableName:"Mesa",sessions:"Sesiones",avgMinutes:"Duración min",appointments:"Citas",completed:"Completadas",cancelled:"Canceladas",noShow:"No asistió",attendancePct:"Atención %",reservations:"Reservaciones",units:"Unidades"}
const currencyKeys=/sales|total|revenue|margin|cost|spent|balance|limit|discount|value|ticket/i
const percentKeys=/pct|rate|roi|confidence/i
const ignored=new Set(["id","organizationId","locationId","productId","employeeId"])
const format=(key:string,value:unknown):string|number|null=>{if(value==null)return "—";if(typeof value!=="number")return String(value);if(currencyKeys.test(key))return value.toLocaleString("es-MX",{style:"currency",currency:"MXN"});if(percentKeys.test(key))return `${value.toLocaleString("es-MX",{maximumFractionDigits:1})}%`;return value.toLocaleString("es-MX",{maximumFractionDigits:2})}

async function dataFor(id:BiReportId,orgId:string,f:Filters):Promise<object[]> {
  switch(id){
    case"omnichannel":return (await bi.getOmnichannelReport(orgId,f)).rows;
    case"heatmap":return (await bi.getHourlyHeatmap(orgId,f)).grid.flat().filter(cell=>cell.count>0).map(cell=>({dayOfWeek:["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][cell.dayOfWeek],hour:`${String(cell.hour).padStart(2,"0")}:00`,sales:cell.sales,count:cell.count}));
    case"inventory":return (await bi.getInventoryValuation(orgId,f)).rows;
    case"ranking":return (await bi.getProductRanking(orgId,f,"revenue")).rows;
    case"cohorts":return (await bi.getCustomerCohorts(orgId,6)).cohorts.map(row=>({cohort:row.cohort,initialCount:row.initialCount,...Object.fromEntries(row.retention.map((value,index)=>[`month${index}`,value]))}));
    case"employee_ranking":return (await bi.getEmployeeRanking(orgId,f)).rows;
    case"loyalty":return (await bi.getLoyaltySummary(orgId,f)).rows;
    case"credit_aging":return (await bi.getCreditAging(orgId)).rows;
    case"promos_roi":return (await bi.getPromotionsRoi(orgId,f)).rows;
    case"delivery":return (await bi.getDeliveryPerformance(orgId,f)).rows;
    case"low_stock":return (await bi.getLowStockAlerts(orgId)).rows;
    case"segmentation":return (await bi.getCustomerSegmentation(orgId)).rows;
    case"margin":return (await bi.getMarginAnalysis(orgId,f)).rows;
    case"daily_trend":return (await bi.getDailyTrend(orgId,f)).rows;
    case"payment_mix":return (await bi.getPaymentMix(orgId,f)).rows;
    case"product_pairs":return (await bi.getProductPairs(orgId,f)).rows;
    case"transfers":return (await bi.getTransferEfficiency(orgId,f)).rows;
    case"fill_rate":return (await bi.getInventoryFillRate(orgId)).rows;
    case"employee_margin":return (await bi.getEmployeeMargin(orgId,f)).rows;
    case"forecast":return (await bi.getSalesForecast(orgId,7,f)).rows;
    case"table_performance":return (await bi.getTablePerformance(orgId,f)).rows;
    case"appointments":return (await bi.getAppointmentsPerformance(orgId,f)).rows;
    case"rentals":return (await bi.getRentalPerformance(orgId,f)).rows;
  }
}

export async function buildBiExportSections(orgId:string,ids:BiReportId[],filters:Filters):Promise<ExecutiveReportSection[]> {
  const sections:ExecutiveReportSection[]=[];
  for(const id of ids){const definition=BI_REPORTS.find(report=>report.id===id);if(!definition)continue;const raw=(await dataFor(id,orgId,filters)) as Record<string,unknown>[];const keys=[...new Set(raw.flatMap(row=>Object.keys(row)))].filter(key=>!ignored.has(key)).slice(0,8);const numeric=keys.filter(key=>raw.some(row=>typeof row[key]==="number"));const primary=numeric.find(key=>currencyKeys.test(key))??numeric[0];const total=primary?raw.reduce((sum,row)=>sum+(typeof row[primary]==="number"?Number(row[primary]):0),0):0;const metrics=[{label:"Registros analizados",value:raw.length.toLocaleString("es-MX")}];if(primary)metrics.push({label:`Total ${LABELS[primary]??primary}`,value:format(primary,total) as string});const first=raw[0];const leading=first&&primary?String(first[Object.keys(first).find(key=>typeof first[key]!=="number")??""]??""):"";const topValue=first&&primary&&typeof first[primary]==="number"?Number(first[primary]):0;const share=total>0?Math.round(topValue/total*100):0;const analysis=!raw.length?`No se registraron datos para este indicador con el periodo y los filtros elegidos.`:primary&&leading?`${leading} encabeza el reporte con ${format(primary,topValue)}${share>0?`, equivalente al ${share}% del total mostrado`:""}. La tabla contiene ${raw.length.toLocaleString("es-MX")} registros ordenados para facilitar la comparación.`:`El periodo contiene ${raw.length.toLocaleString("es-MX")} registros. La tabla presenta el detalle disponible para revisar distribución, excepciones y seguimiento operativo.`;const chart=primary?raw.slice(0,6).map((row,index)=>({label:String(row[keys.find(key=>typeof row[key]!=="number")??""]??`Registro ${index+1}`),value:Number(row[primary]??0)})):undefined;sections.push({title:definition.label,description:definition.description,columns:keys.map(key=>({key,label:LABELS[key]??key.replace(/([A-Z])/g," $1").trim(),align:raw.some(row=>typeof row[key]==="number")?"right":"left"})),rows:raw.slice(0,100).map(row=>Object.fromEntries(keys.map(key=>[key,format(key,row[key])]))),metrics,analysis,chart});}
  return sections;
}

