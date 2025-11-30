import { NextRequest, NextResponse } from 'next/server';
import { getYandexDb } from '@/lib/db';

// Courier name normalization
function normalizeCourier(courier: string | null): string {
  if (!courier) return 'Не указан';
  if (courier === 'СПОСОБ ДОСТАВКИ ИНТЕГРАЛ') return 'ИНТЕГРАЛ';
  if (courier === 'РУ доставка') return 'РУ ДОСТАВКА';
  return courier;
}

// Couriers to exclude from success rate calculation
const EXCLUDED_COURIERS = ['СДЭК', 'Самовывоз'];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get('days') || '30', 10);

  const db = getYandexDb();

  // Calculate date ranges
  const now = new Date();
  const currentPeriodEnd = now.toISOString().split('T')[0];

  const currentPeriodStart = new Date(now);
  currentPeriodStart.setDate(currentPeriodStart.getDate() - days);
  const currentPeriodStartStr = currentPeriodStart.toISOString().split('T')[0];

  // Previous year same period (for YoY comparison)
  const prevYearEnd = new Date(now);
  prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);
  const prevYearEndStr = prevYearEnd.toISOString().split('T')[0];

  const prevYearStart = new Date(currentPeriodStart);
  prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);
  const prevYearStartStr = prevYearStart.toISOString().split('T')[0];

  // KPIs for current period
  // Revenue = sum of 'paid' for completed orders (actual money received after customer tries shoes)
  // Total orders excludes cancelled (Отменен)
  // Pending = not completed (Выполнен) and not cancelled (Отменен)
  const currentKpis = db.prepare(`
    SELECT
      SUM(CASE WHEN status != 'Отменен' THEN 1 ELSE 0 END) as total_orders,
      SUM(CASE WHEN status = 'Выполнен' THEN paid ELSE 0 END) as revenue,
      SUM(CASE WHEN status = 'Выполнен' THEN 1 ELSE 0 END) as completed_orders,
      SUM(CASE WHEN status NOT IN ('Выполнен', 'Отменен') THEN 1 ELSE 0 END) as pending_orders
    FROM moysklad_orders
    WHERE date >= ? AND date < ?
  `).get(currentPeriodStartStr, currentPeriodEnd + ' 23:59:59') as {
    total_orders: number;
    revenue: number;
    completed_orders: number;
    pending_orders: number;
  };

  // KPIs for previous year (YoY)
  const prevYearKpis = db.prepare(`
    SELECT
      SUM(CASE WHEN status != 'Отменен' THEN 1 ELSE 0 END) as total_orders,
      SUM(CASE WHEN status = 'Выполнен' THEN paid ELSE 0 END) as revenue,
      SUM(CASE WHEN status = 'Выполнен' THEN 1 ELSE 0 END) as completed_orders,
      SUM(CASE WHEN status NOT IN ('Выполнен', 'Отменен') THEN 1 ELSE 0 END) as pending_orders
    FROM moysklad_orders
    WHERE date >= ? AND date < ?
  `).get(prevYearStartStr, prevYearEndStr + ' 23:59:59') as {
    total_orders: number;
    revenue: number;
    completed_orders: number;
    pending_orders: number;
  };

  // Orders by day (for chart)
  // Revenue = paid (actual money received)
  const ordersByDay = db.prepare(`
    SELECT
      DATE(date) as day,
      COUNT(*) as orders,
      SUM(CASE WHEN status = 'Выполнен' THEN paid ELSE 0 END) as revenue
    FROM moysklad_orders
    WHERE date >= ? AND date < ?
    GROUP BY DATE(date)
    ORDER BY day
  `).all(currentPeriodStartStr, currentPeriodEnd + ' 23:59:59') as Array<{
    day: string;
    orders: number;
    revenue: number;
  }>;

  // Orders by status (for pie chart)
  const ordersByStatus = db.prepare(`
    SELECT
      status,
      COUNT(*) as count
    FROM moysklad_orders
    WHERE date >= ? AND date < ?
    GROUP BY status
    ORDER BY count DESC
  `).all(currentPeriodStartStr, currentPeriodEnd + ' 23:59:59') as Array<{
    status: string;
    count: number;
  }>;

  // Courier success rate
  // Success = status 'Выполнен' AND paid > 3000 (customer tried on shoes and bought)
  // Failure = status 'Выполнен' AND paid <= 3000 (customer tried but didn't buy)
  // Exclude 'Отменен' (cancelled, never delivered)
  const courierStats = db.prepare(`
    SELECT
      courier,
      COUNT(*) as total_orders,
      SUM(CASE WHEN paid > 3000 THEN 1 ELSE 0 END) as successful_orders
    FROM moysklad_orders
    WHERE date >= ? AND date < ?
      AND status = 'Выполнен'
      AND courier IS NOT NULL
    GROUP BY courier
  `).all(currentPeriodStartStr, currentPeriodEnd + ' 23:59:59') as Array<{
    courier: string;
    total_orders: number;
    successful_orders: number;
  }>;

  // Process courier stats
  const courierSuccess = courierStats
    .filter(c => !EXCLUDED_COURIERS.includes(c.courier))
    .map(c => ({
      courier: normalizeCourier(c.courier),
      total_orders: c.total_orders,
      successful_orders: c.successful_orders,
      success_rate: c.total_orders > 0
        ? Math.round((c.successful_orders / c.total_orders) * 100)
        : 0,
    }))
    .sort((a, b) => b.total_orders - a.total_orders);

  // Calculate overall courier success rate
  const totalCourierOrders = courierSuccess.reduce((sum, c) => sum + c.total_orders, 0);
  const totalSuccessfulOrders = courierSuccess.reduce((sum, c) => sum + c.successful_orders, 0);
  const overallCourierSuccessRate = totalCourierOrders > 0
    ? Math.round((totalSuccessfulOrders / totalCourierOrders) * 100)
    : 0;
  const successRateDecimal = totalCourierOrders > 0
    ? totalSuccessfulOrders / totalCourierOrders
    : 0;

  // Previous year courier success rate for YoY comparison
  const prevYearCourierStats = db.prepare(`
    SELECT
      courier,
      COUNT(*) as total_orders,
      SUM(CASE WHEN paid > 3000 THEN 1 ELSE 0 END) as successful_orders
    FROM moysklad_orders
    WHERE date >= ? AND date < ?
      AND status = 'Выполнен'
      AND courier IS NOT NULL
    GROUP BY courier
  `).all(prevYearStartStr, prevYearEndStr + ' 23:59:59') as Array<{
    courier: string;
    total_orders: number;
    successful_orders: number;
  }>;

  const prevYearCourierFiltered = prevYearCourierStats.filter(c => !EXCLUDED_COURIERS.includes(c.courier));
  const prevYearTotalCourierOrders = prevYearCourierFiltered.reduce((sum, c) => sum + c.total_orders, 0);
  const prevYearTotalSuccessfulOrders = prevYearCourierFiltered.reduce((sum, c) => sum + c.successful_orders, 0);
  const prevYearCourierSuccessRate = prevYearTotalCourierOrders > 0
    ? Math.round((prevYearTotalSuccessfulOrders / prevYearTotalCourierOrders) * 100)
    : 0;

  // Average ticket for successful orders only (paid > 3000)
  const avgTicketSuccess = db.prepare(`
    SELECT AVG(paid) as avg_paid
    FROM moysklad_orders
    WHERE date >= ? AND date < ?
      AND status = 'Выполнен'
      AND paid > 3000
  `).get(currentPeriodStartStr, currentPeriodEnd + ' 23:59:59') as { avg_paid: number | null };

  const avgTicketSuccessValue = avgTicketSuccess.avg_paid || 0;

  // Previous year average ticket for successful orders only (paid > 3000)
  const prevYearAvgTicketSuccess = db.prepare(`
    SELECT AVG(paid) as avg_paid
    FROM moysklad_orders
    WHERE date >= ? AND date < ?
      AND status = 'Выполнен'
      AND paid > 3000
  `).get(prevYearStartStr, prevYearEndStr + ' 23:59:59') as { avg_paid: number | null };

  const prevAvgTicketSuccessValue = prevYearAvgTicketSuccess.avg_paid || 0;

  // YTD (Year-to-Date) revenue comparison
  const currentYear = now.getFullYear();
  const ytdStart = `${currentYear}-01-01`;
  const ytdEnd = currentPeriodEnd; // today

  const prevYear = currentYear - 1;
  const prevYtdStart = `${prevYear}-01-01`;
  // Same day last year
  const prevYtdEnd = `${prevYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Current year YTD
  const ytdKpis = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'Выполнен' THEN paid ELSE 0 END) as revenue,
      SUM(CASE WHEN status NOT IN ('Выполнен', 'Отменен') THEN 1 ELSE 0 END) as pending_orders
    FROM moysklad_orders
    WHERE date >= ? AND date < ?
  `).get(ytdStart, ytdEnd + ' 23:59:59') as {
    revenue: number;
    pending_orders: number;
  };

  // Previous year same period (YTD)
  const prevYtdKpis = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'Выполнен' THEN paid ELSE 0 END) as revenue
    FROM moysklad_orders
    WHERE date >= ? AND date < ?
  `).get(prevYtdStart, prevYtdEnd + ' 23:59:59') as {
    revenue: number;
  };

  // YTD estimated revenue = actual + pending * success rate * avg ticket
  const ytdEstimatedRevenue = (ytdKpis.revenue || 0) + Math.round(
    (ytdKpis.pending_orders || 0) * successRateDecimal * avgTicketSuccessValue
  );

  // Calculate YoY changes
  const calcYoYChange = (current: number, previous: number): number | null => {
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  };

  const completionRate = currentKpis.total_orders > 0
    ? Math.round((currentKpis.completed_orders / currentKpis.total_orders) * 100)
    : 0;

  const prevCompletionRate = prevYearKpis.total_orders > 0
    ? Math.round((prevYearKpis.completed_orders / prevYearKpis.total_orders) * 100)
    : 0;

  // Estimated revenue = actual revenue + (pending orders × success rate × avg ticket for successful orders)
  const estimatedPendingRevenue = Math.round(
    currentKpis.pending_orders * successRateDecimal * avgTicketSuccessValue
  );
  const estimatedTotalRevenue = (currentKpis.revenue || 0) + estimatedPendingRevenue;

  return NextResponse.json({
    kpis: {
      totalOrders: {
        value: currentKpis.total_orders,
        yoyChange: calcYoYChange(currentKpis.total_orders, prevYearKpis.total_orders),
      },
      revenue: {
        value: currentKpis.revenue || 0,
        estimated: estimatedTotalRevenue,
        // YoY: estimated current vs actual previous year (previous year orders are all completed)
        yoyChange: calcYoYChange(estimatedTotalRevenue, prevYearKpis.revenue || 0),
      },
      completedOrders: {
        value: currentKpis.completed_orders,
        yoyChange: calcYoYChange(currentKpis.completed_orders, prevYearKpis.completed_orders),
      },
      completionRate: {
        value: completionRate,
        yoyChange: completionRate - prevCompletionRate,
      },
      avgTicket: {
        value: Math.round(avgTicketSuccessValue),
        yoyChange: calcYoYChange(Math.round(avgTicketSuccessValue), Math.round(prevAvgTicketSuccessValue)),
      },
      pendingOrders: {
        value: currentKpis.pending_orders,
        yoyChange: calcYoYChange(currentKpis.pending_orders, prevYearKpis.pending_orders),
      },
      courierSuccessRate: {
        value: overallCourierSuccessRate,
        // YoY as percentage points difference (e.g., 82% vs 78% = +4)
        yoyChange: prevYearCourierSuccessRate > 0
          ? overallCourierSuccessRate - prevYearCourierSuccessRate
          : null,
      },
    },
    charts: {
      ordersByDay,
      ordersByStatus,
      courierSuccess,
    },
    period: {
      start: currentPeriodStartStr,
      end: currentPeriodEnd,
      days,
    },
    ytd: {
      currentYear,
      prevYear,
      current: {
        revenue: ytdKpis.revenue || 0,
        estimated: ytdEstimatedRevenue,
      },
      previous: {
        revenue: prevYtdKpis.revenue || 0,
      },
      yoyChange: calcYoYChange(ytdEstimatedRevenue, prevYtdKpis.revenue || 0),
    },
  });
}
