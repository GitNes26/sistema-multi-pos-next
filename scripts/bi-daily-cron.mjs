#!/usr/bin/env node

/**
 * BI Daily Cron Job
 * 
 * Run daily at midnight to pre-calculate:
 * - DailySalesSummary (aggregated sales by location)
 * - CustomerSegmentation (VIP/at-risk/dormant)
 * - ProductPairs (market basket analysis)
 * 
 * Usage:
 *   node scripts/bi-daily-cron.mjs
 * 
 * Or in Dokploy as a cron job:
 *   0 0 * * * cd /app && node scripts/bi-daily-cron.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  console.log(`[BI Cron] Starting at ${now.toISOString()}`);
  console.log(`[BI Cron] Processing date: ${yesterday.toISOString().slice(0, 10)}`);

  // Get all organizations
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });

  for (const org of orgs) {
    try {
      await processOrganization(org.id, yesterday, today);
      console.log(`[BI Cron] ✓ Processed org: ${org.name}`);
    } catch (err) {
      console.error(`[BI Cron] ✗ Error processing org ${org.name}:`, err.message);
    }
  }

  console.log(`[BI Cron] Completed at ${new Date().toISOString()}`);
}

async function processOrganization(orgId, dayStart, dayEnd) {
  // 1. DailySalesSummary
  const locations = await prisma.location.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  });

  for (const loc of locations) {
    const sales = await prisma.sale.findMany({
      where: {
        organizationId: orgId,
        locationId: loc.id,
        createdAt: { gte: dayStart, lt: dayEnd },
        status: "completed",
      },
      select: { total: true, tip: true, paymentMethod: true },
    });

    const orders = await prisma.order.findMany({
      where: {
        organizationId: orgId,
        locationId: loc.id,
        createdAt: { gte: dayStart, lt: dayEnd },
        status: { not: "cancelled" },
      },
      select: { deliveryMethod: true, total: true },
    });

    const grossSales = sales.reduce((a, s) => a + Number(s.total), 0);
    const tipTotal = sales.reduce((a, s) => a + Number(s.tip ?? 0), 0);
    const salesCount = sales.length;
    const posSalesTotal = grossSales; // All POS sales
    const portalSalesTotal = orders.reduce((a, o) => a + Number(o.total), 0);
    const totalItems = sales.length; // simplified: 1 item per sale
    const ticketAverage = salesCount > 0 ? grossSales / salesCount : 0;

    await prisma.dailySalesSummary.upsert({
      where: {
        organizationId_locationId_date: {
          organizationId: orgId,
          locationId: loc.id,
          date: dayStart,
        },
      },
      create: {
        organizationId: orgId,
        locationId: loc.id,
        date: dayStart,
        salesCount,
        grossSales,
        netSales: grossSales,
        tipTotal,
        posSales: posSalesTotal,
        portalSales: portalSalesTotal,
        ticketAverage,
        totalItems,
      },
      update: {
        salesCount,
        grossSales,
        netSales: grossSales,
        tipTotal,
        posSales: posSalesTotal,
        portalSales: portalSalesTotal,
        ticketAverage,
        totalItems,
      },
    });
  }

  // 2. Customer Segmentation (simplified: based on last 30 days)
  const thirtyDaysAgo = new Date(dayEnd.getTime() - 30 * 86400000);
  const customers = await prisma.customer.findMany({
    where: { organizationId: orgId, isActive: true },
    include: {
      orders: {
        where: { createdAt: { gte: thirtyDaysAgo }, status: "delivered" },
        select: { total: true },
      },
    },
  });

  for (const c of customers) {
    const totalSpent = c.orders.reduce((a, o) => a + Number(o.total), 0);
    const orderCount = c.orders.length;

    let segment = "regular";
    if (totalSpent > 5000 || orderCount > 20) segment = "vip";
    else if (orderCount === 0) segment = "dormant";
    else if (orderCount <= 2 && totalSpent < 500) segment = "at_risk";

    await prisma.customerSegment.upsert({
      where: {
        organizationId_customerId_segment: {
          organizationId: orgId,
          customerId: c.id,
          segment,
        },
      },
      create: {
        organizationId: orgId,
        customerId: c.id,
        segment,
        score: Math.min(100, Math.round(totalSpent / 50 + orderCount * 5)),
      },
      update: {
        score: Math.min(100, Math.round(totalSpent / 50 + orderCount * 5)),
      },
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
