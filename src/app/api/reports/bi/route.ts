import { NextRequest, NextResponse } from "next/server";
import { reportsGuard, reportsErrorResponse } from "../guard";
import {
  getOmnichannelReport,
  getHourlyHeatmap,
  getInventoryValuation,
  getProductRanking,
  getCustomerCohorts,
  getEmployeeRanking,
  getLoyaltySummary,
  getCreditAging,
  getPromotionsRoi,
  getDeliveryPerformance,
  getLowStockAlerts,
  getCustomerSegmentation,
  getMarginAnalysis,
  getDailyTrend,
  getPaymentMix,
  getProductPairs,
  getTransferEfficiency,
  getInventoryFillRate,
  getEmployeeMargin,
  getSalesForecast,
} from "@/lib/reports/bi-server";

export async function GET(req: NextRequest) {
  const guard = await reportsGuard("reports.view");
  if (guard instanceof NextResponse) return guard;

  const sp = req.nextUrl.searchParams;
  const report = sp.get("report") ?? "omnichannel";
  const from = sp.get("from") || undefined;
  const to = sp.get("to") || undefined;
  const locationId = sp.get("locationId") || undefined;
  const sort = (sp.get("sort") ?? "revenue") as "quantity" | "revenue" | "margin";

  const filters = { from, to, locationId };

  try {
    switch (report) {
      case "omnichannel": {
        const data = await getOmnichannelReport(guard.organizationId, filters);
        return NextResponse.json({ ok: true, ...data });
      }
      case "heatmap": {
        const data = await getHourlyHeatmap(guard.organizationId, filters);
        return NextResponse.json({ ok: true, ...data });
      }
      case "inventory": {
        const data = await getInventoryValuation(guard.organizationId, filters);
        return NextResponse.json({ ok: true, ...data });
      }
      case "ranking": {
        const data = await getProductRanking(guard.organizationId, filters, sort);
        return NextResponse.json({ ok: true, ...data });
      }
      case "cohorts": {
        const months = parseInt(sp.get("months") ?? "6", 10);
        const data = await getCustomerCohorts(guard.organizationId, months);
        return NextResponse.json({ ok: true, ...data });
      }
      case "employee_ranking": {
        const data = await getEmployeeRanking(guard.organizationId, filters);
        return NextResponse.json({ ok: true, ...data });
      }
      case "loyalty": {
        const data = await getLoyaltySummary(guard.organizationId, filters);
        return NextResponse.json({ ok: true, ...data });
      }
      case "credit_aging": {
        const data = await getCreditAging(guard.organizationId);
        return NextResponse.json({ ok: true, ...data });
      }
      case "promos_roi": {
        const data = await getPromotionsRoi(guard.organizationId, filters);
        return NextResponse.json({ ok: true, ...data });
      }
      case "delivery": {
        const data = await getDeliveryPerformance(guard.organizationId, filters);
        return NextResponse.json({ ok: true, ...data });
      }
      case "low_stock": {
        const data = await getLowStockAlerts(guard.organizationId);
        return NextResponse.json({ ok: true, ...data });
      }
      case "segmentation": {
        const data = await getCustomerSegmentation(guard.organizationId);
        return NextResponse.json({ ok: true, ...data });
      }
      case "margin": {
        const data = await getMarginAnalysis(guard.organizationId, filters);
        return NextResponse.json({ ok: true, ...data });
      }
      case "daily_trend": {
        const data = await getDailyTrend(guard.organizationId, filters);
        return NextResponse.json({ ok: true, ...data });
      }
      case "payment_mix": {
        const data = await getPaymentMix(guard.organizationId, filters);
        return NextResponse.json({ ok: true, ...data });
      }
      case "product_pairs": {
        const data = await getProductPairs(guard.organizationId, filters);
        return NextResponse.json({ ok: true, ...data });
      }
      case "transfers": {
        const data = await getTransferEfficiency(guard.organizationId, filters);
        return NextResponse.json({ ok: true, ...data });
      }
      case "fill_rate": {
        const data = await getInventoryFillRate(guard.organizationId);
        return NextResponse.json({ ok: true, ...data });
      }
      case "employee_margin": {
        const data = await getEmployeeMargin(guard.organizationId, filters);
        return NextResponse.json({ ok: true, ...data });
      }
      case "forecast": {
        const days = parseInt(sp.get("days") ?? "7", 10);
        const data = await getSalesForecast(guard.organizationId, days);
        return NextResponse.json({ ok: true, ...data });
      }
      default:
        return NextResponse.json({ ok: false, error: `Reporte desconocido: ${report}` }, { status: 400 });
    }
  } catch (err) {
    return reportsErrorResponse(err);
  }
}
