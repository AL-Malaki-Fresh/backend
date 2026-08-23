const prisma = require("../config/prisma");

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  return Number(value);
};

const roundMoney = (value) => {
  return Number((Number(value) || 0).toFixed(2));
};

const getDateRange = (period) => {
  const now = new Date();

  if (!period || period === "30d") {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
    return { startDate, endDate: now };
  }

  if (period === "7d") {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
    return { startDate, endDate: now };
  }

  if (period === "90d") {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 90);
    return { startDate, endDate: now };
  }

  if (period === "all") {
    return { startDate: null, endDate: null };
  }

  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 30);

  return { startDate, endDate: now };
};

const buildDateWhere = (period) => {
  const { startDate, endDate } = getDateRange(period);

  if (!startDate || !endDate) {
    return {};
  }

  return {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };
};

const groupOrdersByDay = (orders) => {
  const grouped = {};

  orders.forEach((order) => {
    const date = new Date(order.createdAt).toISOString().slice(0, 10);

    if (!grouped[date]) {
      grouped[date] = {
        date,
        sales: 0,
        orders: 0,
      };
    }

    grouped[date].sales += toNumber(order.totalAmount);
    grouped[date].orders += 1;
  });

  return Object.values(grouped).map((item) => ({
    ...item,
    sales: roundMoney(item.sales),
  }));
};

const calculateTopProducts = (orderItems) => {
  const groupedProducts = {};

  orderItems.forEach((item) => {
    const key = item.productId || item.productName;

    if (!groupedProducts[key]) {
      groupedProducts[key] = {
        productId: item.productId,
        name: item.productName,
        nameAr: item.productNameAr,
        quantitySold: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
    }

    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const costPrice = toNumber(item.product?.costPrice);

    const revenue = quantity * unitPrice;
    const cost = quantity * costPrice;

    groupedProducts[key].quantitySold += quantity;
    groupedProducts[key].revenue += revenue;
    groupedProducts[key].cost += cost;
    groupedProducts[key].profit += revenue - cost;
  });

  return Object.values(groupedProducts)
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 5)
    .map((product) => ({
      ...product,
      revenue: roundMoney(product.revenue),
      cost: roundMoney(product.cost),
      profit: roundMoney(product.profit),
    }));
};

const calculateInventory = async () => {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      nameAr: true,
      price: true,
      costPrice: true,
      stockQuantity: true,
      lowStockThreshold: true,
      inStock: true,
      isActive: true,
      imageUrl: true,
      category: {
        select: {
          id: true,
          name: true,
          nameAr: true,
        },
      },
    },
  });

  const totalProducts = products.length;
  const activeProducts = products.filter((product) => product.isActive).length;

  const lowStockProducts = products.filter((product) => {
    const quantity = toNumber(product.stockQuantity);
    const threshold = toNumber(product.lowStockThreshold);

    return product.inStock && quantity > 0 && quantity <= threshold;
  });

  const outOfStockProducts = products.filter((product) => {
    const quantity = toNumber(product.stockQuantity);

    return !product.inStock || quantity <= 0;
  });

  const stockCostValue = products.reduce((sum, product) => {
    return (
      sum +
      toNumber(product.stockQuantity) * toNumber(product.costPrice)
    );
  }, 0);

  const potentialSalesValue = products.reduce((sum, product) => {
    return sum + toNumber(product.stockQuantity) * toNumber(product.price);
  }, 0);

  const potentialProfit = potentialSalesValue - stockCostValue;

  const lowStockList = lowStockProducts
    .sort(
      (a, b) =>
        toNumber(a.stockQuantity) - toNumber(b.stockQuantity)
    )
    .slice(0, 6)
    .map((product) => ({
      id: product.id,
      name: product.name,
      nameAr: product.nameAr,
      imageUrl: product.imageUrl,
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
      category: product.category,
    }));

  return {
    inventory: {
      totalProducts,
      activeProducts,
      lowStock: lowStockProducts.length,
      outOfStock: outOfStockProducts.length,
      stockCostValue: roundMoney(stockCostValue),
      potentialSalesValue: roundMoney(potentialSalesValue),
      potentialProfit: roundMoney(potentialProfit),
    },
    lowStockProducts: lowStockList,
  };
};

const getDashboardStats = async (query = {}) => {
  const period = query.period || "30d";
  const dateWhere = buildDateWhere(period);

  const paidOrderWhere = {
    ...dateWhere,
    paymentStatus: "PAID",
    status: {
      not: "CANCELLED",
    },
  };

  const [
    totalOrders,
    paidOrdersAggregate,
    orderStatusGroups,
    paymentStatusGroups,
    paidOrders,
    paidOrderItems,
    recentOrders,
    inventoryResult,
  ] = await Promise.all([
    prisma.order.count({
      where: dateWhere,
    }),

    prisma.order.aggregate({
      where: paidOrderWhere,
      _sum: {
        totalAmount: true,
        subtotal: true,
        deliveryFee: true,
        taxAmount: true,
        discountAmount: true,
      },
      _count: {
        id: true,
      },
    }),

    prisma.order.groupBy({
      by: ["status"],
      where: dateWhere,
      _count: {
        _all: true,
      },
    }),

    prisma.order.groupBy({
      by: ["paymentStatus"],
      where: dateWhere,
      _count: {
        _all: true,
      },
    }),

    prisma.order.findMany({
      where: paidOrderWhere,
      select: {
        id: true,
        totalAmount: true,
        subtotal: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),

    prisma.orderItem.findMany({
      where: {
        order: paidOrderWhere,
      },
      select: {
        id: true,
        productId: true,
        productName: true,
        productNameAr: true,
        unitPrice: true,
        quantity: true,
        product: {
          select: {
            costPrice: true,
          },
        },
      },
    }),

    prisma.order.findMany({
      where: dateWhere,
      take: 6,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        orderNumber: true,
        customerEmail: true,
        customerPhone: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        items: {
          select: {
            id: true,
          },
        },
      },
    }),

    calculateInventory(),
  ]);

  const totalSales = toNumber(paidOrdersAggregate._sum.totalAmount);
  const productRevenue = toNumber(paidOrdersAggregate._sum.subtotal);
  const deliveryFees = toNumber(paidOrdersAggregate._sum.deliveryFee);
  const taxAmount = toNumber(paidOrdersAggregate._sum.taxAmount);
  const discountAmount = toNumber(paidOrdersAggregate._sum.discountAmount);
  const paidOrdersCount = paidOrdersAggregate._count.id || 0;

  const productCost = paidOrderItems.reduce((sum, item) => {
    return (
      sum +
      toNumber(item.quantity) * toNumber(item.product?.costPrice)
    );
  }, 0);

  const grossProfit = productRevenue - productCost;

  const profitMargin =
    productRevenue > 0 ? (grossProfit / productRevenue) * 100 : 0;

  const averageOrderValue =
    paidOrdersCount > 0 ? totalSales / paidOrdersCount : 0;

  const ordersByStatus = orderStatusGroups.reduce((acc, item) => {
    acc[item.status] = item._count._all;
    return acc;
  }, {});

  const paymentsByStatus = paymentStatusGroups.reduce((acc, item) => {
    acc[item.paymentStatus] = item._count._all;
    return acc;
  }, {});

  const topProducts = calculateTopProducts(paidOrderItems);
  const salesByDay = groupOrdersByDay(paidOrders);

  return {
    period,

    financial: {
      totalSales: roundMoney(totalSales),
      productRevenue: roundMoney(productRevenue),
      productCost: roundMoney(productCost),
      grossProfit: roundMoney(grossProfit),
      profitMargin: roundMoney(profitMargin),
      averageOrderValue: roundMoney(averageOrderValue),
      deliveryFees: roundMoney(deliveryFees),
      taxAmount: roundMoney(taxAmount),
      discountAmount: roundMoney(discountAmount),
    },

    orders: {
      total: totalOrders,
      pending: ordersByStatus.PENDING || 0,
      confirmed: ordersByStatus.CONFIRMED || 0,
      preparing: ordersByStatus.PREPARING || 0,
      outForDelivery: ordersByStatus.OUT_FOR_DELIVERY || 0,
      delivered: ordersByStatus.DELIVERED || 0,
      cancelled: ordersByStatus.CANCELLED || 0,
      paid: paymentsByStatus.PAID || 0,
      paymentPending: paymentsByStatus.PENDING || 0,
      paymentFailed: paymentsByStatus.FAILED || 0,
      refunded: paymentsByStatus.REFUNDED || 0,
    },

    inventory: inventoryResult.inventory,

    topProducts,
    salesByDay,
    recentOrders,
    lowStockProducts: inventoryResult.lowStockProducts,
  };
};

module.exports = {
  getDashboardStats,
};