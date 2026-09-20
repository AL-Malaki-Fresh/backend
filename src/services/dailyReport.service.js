const prisma = require("../config/prisma");

/*
 * Daily admin report (stock / sales / rejections / cash vs card).
 *
 * "Today" is a business day in the store's timezone (Qatar, UTC+3, no DST),
 * not a UTC day — otherwise orders placed after 21:00 local time would land
 * on the next day's report. Override with REPORT_TZ_OFFSET_HOURS if needed.
 *
 * Definitions (kept identical in the dashboard UI labels):
 *  - Booked sales  = orders CREATED that day, excluding CANCELLED ones.
 *  - Collected     = money actually received: paymentStatus PAID, counted on
 *                    the day it was paid (paidAt, falling back to createdAt).
 *                    Cash orders only become PAID when the admin marks them
 *                    paid, so booked - collected = money still to collect.
 *  - Rejections    = orders whose CANCELLED transition happened that day
 *                    (from order_status_history, with the admin's note as the
 *                    reason) plus orders created that day whose payment FAILED.
 */

const TZ_OFFSET_HOURS = Number.isFinite(Number(process.env.REPORT_TZ_OFFSET_HOURS))
  ? Number(process.env.REPORT_TZ_OFFSET_HOURS)
  : 3;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TREND_DAYS = 14;

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  return Number(value) || 0;
};

const money = (value) => Number((Number(value) || 0).toFixed(2));

// "YYYY-MM-DD" business-day key for a UTC instant.
const dayKey = (date) =>
  new Date(new Date(date).getTime() + TZ_OFFSET_HOURS * HOUR_MS)
    .toISOString()
    .slice(0, 10);

const hourOfDay = (date) =>
  new Date(new Date(date).getTime() + TZ_OFFSET_HOURS * HOUR_MS).getUTCHours();

// UTC instant at which the business day `key` starts.
const dayStart = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - TZ_OFFSET_HOURS * HOUR_MS);
};

const addDays = (key, days) =>
  new Date(new Date(`${key}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

const resolveDate = (input) => {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(String(input))) {
    const parsed = new Date(`${input}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) return String(input);
  }
  return dayKey(new Date());
};

const emptyMethodBucket = () => ({
  orders: 0,
  booked: 0,
  collected: 0,
  collectedOrders: 0,
  outstanding: 0,
});

const percentChange = (current, previous) => {
  if (!previous) return current ? null : 0; // null = "new", no baseline
  return money(((current - previous) / previous) * 100);
};

const getDailyReport = async (query = {}) => {
  const date = resolveDate(query.date);
  // detail=1 powers the full "detailed report" page / PDF: no row limits,
  // plus the order list, financial breakdown and (optionally) the inventory.
  const detail = ["1", "true"].includes(String(query.detail || ""));
  const includeInventory = detail && ["1", "true"].includes(String(query.inventory || ""));
    const start = dayStart(date);
  const end = dayStart(addDays(date, 1));
  const trendStartKey = addDays(date, -(TREND_DAYS - 1));
  const trendStart = dayStart(trendStartKey);

  const dayCreatedWhere = { createdAt: { gte: start, lt: end } };

  const [
    trendOrders,
    trendPaid,
    cancelHistory,
    failedPayments,
    dayItems,
    products,
    recentOrders,
    detailOrders,
  ] = await Promise.all([
    // Every order created in the trend window (cheap columns only).
    prisma.order.findMany({
      where: { createdAt: { gte: trendStart, lt: end } },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        totalAmount: true,
        createdAt: true,
      },
    }),

    // Orders paid inside the trend window, by the day the money arrived.
    prisma.order.findMany({
      where: {
        paymentStatus: "PAID",
        OR: [
          { paidAt: { gte: trendStart, lt: end } },
          { paidAt: null, createdAt: { gte: trendStart, lt: end } },
        ],
      },
      select: {
        id: true,
        paymentMethod: true,
        totalAmount: true,
        paidAt: true,
        createdAt: true,
      },
    }),

    // CANCELLED transitions that happened on the selected day.
    prisma.orderStatusHistory.findMany({
      where: { status: "CANCELLED", createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        notes: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            paymentMethod: true,
            paymentStatus: true,
            customerPhone: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),

    prisma.order.findMany({
      where: { ...dayCreatedWhere, paymentStatus: "FAILED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        paymentMethod: true,
        createdAt: true,
        customerPhone: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),

    // Items sold on the selected day (non-cancelled orders).
    prisma.orderItem.findMany({
      where: { order: { ...dayCreatedWhere, status: { not: "CANCELLED" } } },
      select: {
        productId: true,
        productName: true,
        productNameAr: true,
        unitPrice: true,
        quantity: true,
        product: {
          select: {
            costPrice: true,
            stockQuantity: true,
            imageUrl: true,
            category: { select: { id: true, name: true, nameAr: true } },
          },
        },
      },
    }),

    // Current stock snapshot.
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        nameAr: true,
        imageUrl: true,
        price: true,
        costPrice: true,
        stockQuantity: true,
        lowStockThreshold: true,
        inStock: true,
        isActive: true,
        category: { select: { id: true, name: true, nameAr: true } },
      },
    }),

    prisma.order.findMany({
      where: dayCreatedWhere,
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        totalAmount: true,
        createdAt: true,
        customerPhone: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    detail
      ? prisma.order.findMany({
          where: dayCreatedWhere,
          orderBy: { createdAt: "asc" },
          take: 500,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            subtotal: true,
            discountAmount: true,
            promotionDiscount: true,
            taxAmount: true,
            deliveryFee: true,
            totalAmount: true,
            couponCode: true,
            createdAt: true,
            paidAt: true,
            customerPhone: true,
            userId: true,
            user: { select: { firstName: true, lastName: true } },
            items: {
              select: { productName: true, productNameAr: true, quantity: true, unitPrice: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  // ── Trend (last 14 business days) ─────────────────────────────────────
  const trendMap = {};
  for (let i = 0; i < TREND_DAYS; i += 1) {
    const key = addDays(trendStartKey, i);
    trendMap[key] = {
      date: key,
      orders: 0,
      booked: 0,
      collected: 0,
      cash: 0,
      card: 0,
      cancelled: 0,
    };
  }

  trendOrders.forEach((order) => {
    const bucket = trendMap[dayKey(order.createdAt)];
    if (!bucket) return;
    if (order.status === "CANCELLED") {
      bucket.cancelled += 1;
      return;
    }
    bucket.orders += 1;
    bucket.booked += toNumber(order.totalAmount);
  });

  trendPaid.forEach((order) => {
    const bucket = trendMap[dayKey(order.paidAt || order.createdAt)];
    if (!bucket) return;
    const amount = toNumber(order.totalAmount);
    bucket.collected += amount;
    if (order.paymentMethod === "CASH") bucket.cash += amount;
    if (order.paymentMethod === "CARD") bucket.card += amount;
  });

  const trend = Object.values(trendMap).map((row) => ({
    ...row,
    booked: money(row.booked),
    collected: money(row.collected),
    cash: money(row.cash),
    card: money(row.card),
  }));

  const today = trendMap[date];
  const yesterday = trendMap[addDays(date, -1)];

  // ── Payments: cash vs card (booked today + collected today) ───────────
  const payments = { CASH: emptyMethodBucket(), CARD: emptyMethodBucket(), WALLET: emptyMethodBucket() };

  trendOrders.forEach((order) => {
    if (dayKey(order.createdAt) !== date || order.status === "CANCELLED") return;
    const bucket = payments[order.paymentMethod || "CASH"];
    if (!bucket) return;
    bucket.orders += 1;
    bucket.booked += toNumber(order.totalAmount);
  });

  trendPaid.forEach((order) => {
    if (dayKey(order.paidAt || order.createdAt) !== date) return;
    const bucket = payments[order.paymentMethod || "CASH"];
    if (!bucket) return;
    bucket.collectedOrders += 1;
    bucket.collected += toNumber(order.totalAmount);
  });

  Object.values(payments).forEach((bucket) => {
    bucket.outstanding = Math.max(bucket.booked - bucket.collected, 0);
    bucket.booked = money(bucket.booked);
    bucket.collected = money(bucket.collected);
    bucket.outstanding = money(bucket.outstanding);
  });

  // ── Hourly distribution of today's booked sales ───────────────────────
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, sales: 0 }));
  trendOrders.forEach((order) => {
    if (dayKey(order.createdAt) !== date || order.status === "CANCELLED") return;
    const bucket = hourly[hourOfDay(order.createdAt)];
    bucket.orders += 1;
    bucket.sales += toNumber(order.totalAmount);
  });
  hourly.forEach((row) => {
    row.sales = money(row.sales);
  });

  // ── Order status funnel for orders created today ──────────────────────
  const statusCounts = {};
  trendOrders.forEach((order) => {
    if (dayKey(order.createdAt) !== date) return;
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
  });
  const ordersCreated = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  // ── Sold today: products + categories + margin ────────────────────────
  const soldByProduct = {};
  const soldByCategory = {};
  let itemsRevenue = 0;
  let itemsCost = 0;
  let unitsSold = 0;

  dayItems.forEach((item) => {
    const quantity = toNumber(item.quantity);
    const revenue = quantity * toNumber(item.unitPrice);
    const cost = quantity * toNumber(item.product?.costPrice);

    itemsRevenue += revenue;
    itemsCost += cost;
    unitsSold += quantity;

    const productKey = item.productId || item.productName;
    if (!soldByProduct[productKey]) {
      soldByProduct[productKey] = {
        productId: item.productId,
        name: item.productName,
        nameAr: item.productNameAr,
        imageUrl: item.product?.imageUrl || null,
        remainingStock: item.product ? toNumber(item.product.stockQuantity) : null,
        quantitySold: 0,
        revenue: 0,
        cost: 0,
      };
    }
    soldByProduct[productKey].quantitySold += quantity;
    soldByProduct[productKey].revenue += revenue;
    soldByProduct[productKey].cost += cost;

    const category = item.product?.category;
    const categoryKey = category?.id || "none";
    if (!soldByCategory[categoryKey]) {
      soldByCategory[categoryKey] = {
        categoryId: category?.id || null,
        name: category?.name || "Uncategorized",
        nameAr: category?.nameAr || "بدون تصنيف",
        revenue: 0,
        quantitySold: 0,
      };
    }
    soldByCategory[categoryKey].revenue += revenue;
    soldByCategory[categoryKey].quantitySold += quantity;
  });

  const topProducts = Object.values(soldByProduct)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, detail ? undefined : 8)
    .map((row) => ({
      ...row,
      revenue: money(row.revenue),
      cost: money(row.cost),
      profit: money(row.revenue - row.cost),
    }));

  const categories = Object.values(soldByCategory)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, detail ? undefined : 8)
    .map((row) => ({ ...row, revenue: money(row.revenue) }));

  // ── Stock snapshot ────────────────────────────────────────────────────
  const activeProducts = products.filter((p) => p.isActive);
  const isOut = (p) => !p.inStock || toNumber(p.stockQuantity) <= 0;
  const isLow = (p) =>
    p.inStock &&
    toNumber(p.stockQuantity) > 0 &&
    toNumber(p.stockQuantity) <= toNumber(p.lowStockThreshold);

  const outOfStock = activeProducts.filter(isOut);
  const lowStock = activeProducts.filter(isLow);
  const healthy = activeProducts.length - outOfStock.length - lowStock.length;

  const stockCostValue = activeProducts.reduce(
    (sum, p) => sum + toNumber(p.stockQuantity) * toNumber(p.costPrice),
    0
  );
  const stockSalesValue = activeProducts.reduce(
    (sum, p) => sum + toNumber(p.stockQuantity) * toNumber(p.price),
    0
  );

  const slimProduct = (p) => ({
    id: p.id,
    name: p.name,
    nameAr: p.nameAr,
    imageUrl: p.imageUrl,
    stockQuantity: toNumber(p.stockQuantity),
    lowStockThreshold: toNumber(p.lowStockThreshold),
    category: p.category,
  });

  // ── Rejections ────────────────────────────────────────────────────────
  const customerName = (user) =>
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;

  const cancelled = cancelHistory.map((entry) => ({
    id: entry.id,
    orderId: entry.order.id,
    orderNumber: entry.order.orderNumber,
    amount: money(entry.order.totalAmount),
    paymentMethod: entry.order.paymentMethod,
    paymentStatus: entry.order.paymentStatus,
    reason: entry.notes || null,
    customer: customerName(entry.order.user) || entry.order.customerPhone || null,
    cancelledAt: entry.createdAt,
  }));

  const failed = failedPayments.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    amount: money(order.totalAmount),
    paymentMethod: order.paymentMethod,
    customer: customerName(order.user) || order.customerPhone || null,
    createdAt: order.createdAt,
  }));

  const cancelledCohort = statusCounts.CANCELLED || 0;
  const reasonMap = {};
  cancelled.forEach((row) => {
    const key = row.reason || "__none__";
    reasonMap[key] = reasonMap[key] || { reason: row.reason, count: 0, amount: 0 };
    reasonMap[key].count += 1;
    reasonMap[key].amount += row.amount;
  });

  const cancelledAmount = cancelled.reduce((sum, row) => sum + row.amount, 0);
  const failedAmount = failed.reduce((sum, row) => sum + row.amount, 0);

  let detailBlock;
  if (detail) {
    const live = detailOrders.filter((order) => order.status !== "CANCELLED");
    const sum = (rows, field) => rows.reduce((acc, row) => acc + toNumber(row[field]), 0);

    const statusBreakdown = {};
    detailOrders.forEach((order) => {
      const row = (statusBreakdown[order.status] = statusBreakdown[order.status] || { count: 0, amount: 0 });
      row.count += 1;
      row.amount += toNumber(order.totalAmount);
    });
    Object.values(statusBreakdown).forEach((row) => {
      row.amount = money(row.amount);
    });

    const customerIds = new Set(live.map((order) => order.userId || order.customerPhone).filter(Boolean));

    detailBlock = {
      financial: {
        productsSubtotal: money(sum(live, "subtotal") + sum(live, "promotionDiscount")),
        promotionDiscount: money(sum(live, "promotionDiscount")),
        couponDiscount: money(sum(live, "discountAmount")),
        subtotalAfterPromotions: money(sum(live, "subtotal")),
        deliveryFees: money(sum(live, "deliveryFee")),
        tax: money(sum(live, "taxAmount")),
        total: money(sum(live, "totalAmount")),
        productCost: money(itemsCost),
        grossProfit: money(itemsRevenue - itemsCost),
        couponOrders: live.filter((order) => order.couponCode).length,
      },
      customers: customerIds.size,
      statusBreakdown,
      orders: detailOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        amount: money(order.totalAmount),
        deliveryFee: money(order.deliveryFee),
        discount: money(toNumber(order.discountAmount) + toNumber(order.promotionDiscount)),
        couponCode: order.couponCode || null,
        customer: customerName(order.user) || order.customerPhone || null,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        items: order.items.map((item) => ({
          name: item.productName,
          nameAr: item.productNameAr,
          quantity: toNumber(item.quantity),
          unitPrice: money(item.unitPrice),
        })),
      })),
      inventory: includeInventory
        ? activeProducts
            .map((p) => ({
              ...slimProduct(p),
              state: isOut(p) ? "out" : isLow(p) ? "low" : "ok",
              costValue: money(toNumber(p.stockQuantity) * toNumber(p.costPrice)),
              salesValue: money(toNumber(p.stockQuantity) * toNumber(p.price)),
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
        : null,
    };
  }

  return {
    date,
    timezoneOffsetHours: TZ_OFFSET_HOURS,
    generatedAt: new Date().toISOString(),

    summary: {
      ordersCreated,
      orders: today.orders,
      bookedSales: money(today.booked),
      collected: money(today.collected),
      outstanding: money(Math.max(today.booked - today.collected, 0)),
      averageOrderValue: money(today.orders ? today.booked / today.orders : 0),
      unitsSold,
      grossProfit: money(itemsRevenue - itemsCost),
      profitMargin: money(itemsRevenue ? ((itemsRevenue - itemsCost) / itemsRevenue) * 100 : 0),
      vsYesterday: {
        booked: percentChange(today.booked, yesterday?.booked || 0),
        orders: percentChange(today.orders, yesterday?.orders || 0),
        collected: percentChange(today.collected, yesterday?.collected || 0),
        yesterdayBooked: money(yesterday?.booked || 0),
      },
    },

    payments: {
      cash: payments.CASH,
      card: payments.CARD,
      wallet: payments.WALLET,
      collectedTotal: money(today.collected),
    },

    orderStatus: statusCounts,
    ...(detail ? { detail: detailBlock } : {}),
    hourly,
    trend,
    topProducts,
    categories,
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      amount: money(order.totalAmount),
      customer: customerName(order.user) || order.customerPhone || null,
      createdAt: order.createdAt,
    })),

    rejections: {
      cancelledCount: cancelled.length,
      cancelledAmount: money(cancelledAmount),
      failedPaymentCount: failed.length,
      failedPaymentAmount: money(failedAmount),
      lostRevenue: money(cancelledAmount + failedAmount),
      // Share of today's orders that ended up cancelled.
      cancellationRate: money(ordersCreated ? (cancelledCohort / ordersCreated) * 100 : 0),
      byReason: Object.values(reasonMap)
        .map((row) => ({ ...row, amount: money(row.amount) }))
        .sort((a, b) => b.count - a.count),
      cancelled: cancelled.slice(0, detail ? 200 : 20),
      failedPayments: failed.slice(0, detail ? 200 : 20),
    },

    stock: {
      totalProducts: products.length,
      activeProducts: activeProducts.length,
      healthy,
      lowStock: lowStock.length,
      outOfStock: outOfStock.length,
      stockCostValue: money(stockCostValue),
      stockSalesValue: money(stockSalesValue),
      potentialProfit: money(stockSalesValue - stockCostValue),
      lowStockProducts: lowStock
        .sort((a, b) => toNumber(a.stockQuantity) - toNumber(b.stockQuantity))
        .slice(0, detail ? 500 : 10)
        .map(slimProduct),
      outOfStockProducts: outOfStock.slice(0, detail ? 500 : 10).map(slimProduct),
    },
  };
};

module.exports = { getDailyReport };
