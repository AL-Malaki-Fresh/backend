const {
  Prisma,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
} = require("@prisma/client");

const prisma = require("../config/prisma");
const notificationService = require(
  "./notification.service"
);
const deliverySettingService = require(
  "./delivery-setting.service"
);

const MAX_LIMIT = 100;
const DEFAULT_ADMIN_LIMIT = 10;
const DEFAULT_MOBILE_LIMIT = 10;

// ─── Error Helper ───────────────────────────────────────────────────────────

const createError = (
  message,
  statusCode,
  code
) => {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  return error;
};

// ─── Prisma Selections ──────────────────────────────────────────────────────

const orderItemSelect = {
  id: true,
  productId: true,
  productName: true,
  productNameAr: true,
  unitPrice: true,
  quantity: true,
  createdAt: true,

  product: {
    select: {
      id: true,
      name: true,
      nameAr: true,
      slug: true,
      galleryImages: true,
    },
  },
};

const orderSelectForMobile = {
  id: true,
  orderNumber: true,

  status: true,

  paymentStatus: true,
  paymentMethod: true,
  paymentId: true,
  paidAt: true,

  subtotal: true,
  discountAmount: true,
  taxAmount: true,
  deliveryFee: true,
  totalAmount: true,

  notes: true,
  deliveryAddress: true,

  estimatedDeliveryTime: true,
  actualDeliveryTime: true,

  createdAt: true,
  updatedAt: true,

  items: {
    select: orderItemSelect,
  },
};

const orderSelectForPayment = {
  id: true,
  orderNumber: true,
  userId: true,

  status: true,
  paymentStatus: true,
  paymentMethod: true,
  paymentId: true,
  paidAt: true,

  totalAmount: true,
  deliveryAddress: true,

  createdAt: true,
  updatedAt: true,
};

const orderSelectForAdmin = {
  id: true,
  orderNumber: true,
  userId: true,

  customerEmail: true,
  customerPhone: true,

  status: true,

  paymentStatus: true,
  paymentMethod: true,
  paymentId: true,
  paidAt: true,

  subtotal: true,
  discountAmount: true,
  taxAmount: true,
  deliveryFee: true,
  totalAmount: true,

  notes: true,
  deliveryAddress: true,

  estimatedDeliveryTime: true,
  actualDeliveryTime: true,

  createdAt: true,
  updatedAt: true,

  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },

  items: {
    select: orderItemSelect,
  },

  statusHistory: {
    orderBy: {
      createdAt: "desc",
    },

    select: {
      id: true,
      status: true,
      notes: true,
      createdAt: true,

      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  },
};

// ─── Normalization Helpers ──────────────────────────────────────────────────

const normalizeString = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalizedValue = String(
    value
  ).trim();

  return normalizedValue || null;
};

const getPagination = ({
  page = 1,
  limit = 10,
} = {}) => {
  const rawPage = Number(page);
  const rawLimit = Number(limit);

  const pageNumber =
    Number.isFinite(rawPage) &&
    rawPage > 0
      ? Math.floor(rawPage)
      : 1;

  const limitNumber =
    Number.isFinite(rawLimit) &&
    rawLimit > 0
      ? Math.min(
          Math.floor(rawLimit),
          MAX_LIMIT
        )
      : limit;

  return {
    pageNumber,
    limitNumber,
    skip:
      (pageNumber - 1) *
      limitNumber,
  };
};

const normalizeEnumValue = (
  value,
  enumObject
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const requestedValue = String(
    value
  )
    .trim()
    .toLowerCase();

  return Object.values(
    enumObject
  ).find(
    (enumValue) =>
      String(enumValue).toLowerCase() ===
      requestedValue
  );
};

// ─── Validation Helpers ─────────────────────────────────────────────────────

const validateOrderStatus = (
  status
) => {
  const normalizedStatus =
    normalizeEnumValue(
      status,
      OrderStatus
    );

  if (!normalizedStatus) {
    throw createError(
      "Invalid order status",
      400,
      "INVALID_ORDER_STATUS"
    );
  }

  return normalizedStatus;
};

const validatePaymentStatus = (
  paymentStatus
) => {
  const normalizedPaymentStatus =
    normalizeEnumValue(
      paymentStatus,
      PaymentStatus
    );

  if (!normalizedPaymentStatus) {
    throw createError(
      "Invalid payment status",
      400,
      "INVALID_PAYMENT_STATUS"
    );
  }

  return normalizedPaymentStatus;
};

const validatePaymentMethod = (
  paymentMethod = PaymentMethod.CASH
) => {
  const normalizedPaymentMethod =
    normalizeEnumValue(
      paymentMethod,
      PaymentMethod
    );

  if (!normalizedPaymentMethod) {
    throw createError(
      "Invalid payment method",
      400,
      "INVALID_PAYMENT_METHOD"
    );
  }

  return normalizedPaymentMethod;
};

// ─── Order Status Transitions ───────────────────────────────────────────────

const ORDER_STATUS_TRANSITIONS = {
  [OrderStatus.PENDING]: [
    OrderStatus.CONFIRMED,
    OrderStatus.CANCELLED,
  ],

  [OrderStatus.CONFIRMED]: [
    OrderStatus.PREPARING,
    OrderStatus.CANCELLED,
  ],

  [OrderStatus.PREPARING]: [
    OrderStatus.DELIVERING,
    OrderStatus.CANCELLED,
  ],

  [OrderStatus.DELIVERING]: [
    OrderStatus.DELIVERED,
  ],

  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

const validateStatusTransition = (
  currentStatus,
  nextStatus
) => {
  if (
    currentStatus === nextStatus
  ) {
    return;
  }

  const allowedNextStatuses =
    ORDER_STATUS_TRANSITIONS[
      currentStatus
    ] || [];

  if (
    !allowedNextStatuses.includes(
      nextStatus
    )
  ) {
    throw createError(
      `Cannot change order status from ${currentStatus} to ${nextStatus}`,
      400,
      "INVALID_ORDER_STATUS_TRANSITION"
    );
  }
};

const STATUS_ROLE_PERMISSIONS = {
  [OrderStatus.CONFIRMED]: [
    "ADMIN",
  ],

  [OrderStatus.PREPARING]: [
    "ADMIN",
  ],

  [OrderStatus.DELIVERING]: [
    "ADMIN",
  ],

  [OrderStatus.DELIVERED]: [
    "ADMIN",
  ],

  [OrderStatus.CANCELLED]: [
    "ADMIN",
  ],
};

const validateStatusPermission = (
  nextStatus,
  actorRole
) => {
  const normalizedRole = String(
    actorRole || ""
  ).toUpperCase();

  const allowedRoles =
    STATUS_ROLE_PERMISSIONS[
      nextStatus
    ] || [];

  if (
    !allowedRoles.includes(
      normalizedRole
    )
  ) {
    throw createError(
      `Role ${normalizedRole} is not allowed to change order status to ${nextStatus}`,
      403,
      "ORDER_STATUS_PERMISSION_DENIED"
    );
  }
};

// ─── Payment Status Transitions ─────────────────────────────────────────────

const PAYMENT_STATUS_TRANSITIONS = {
  PENDING: [
    "PENDING",
    "PAID",
    "FAILED",
    "REFUNDED",
  ],

  PAID: [
    "PENDING",
    "PAID",
    "FAILED",
    "REFUNDED",
  ],

  FAILED: [
    "PENDING",
    "PAID",
    "FAILED",
    "REFUNDED",
  ],

  REFUNDED: [
    "PENDING",
    "PAID",
    "FAILED",
    "REFUNDED",
  ],
};

const validatePaymentStatusTransition =
  (
    currentStatus,
    nextStatus
  ) => {
    if (
      currentStatus === nextStatus
    ) {
      return;
    }

    const allowedNextStatuses =
      PAYMENT_STATUS_TRANSITIONS[
        currentStatus
      ] || [];

    if (
      !allowedNextStatuses.includes(
        nextStatus
      )
    ) {
      throw createError(
        `Cannot change payment status from ${currentStatus} to ${nextStatus}`,
        400,
        "INVALID_PAYMENT_STATUS_TRANSITION"
      );
    }
  };

// ─── Delivery Address Validation ────────────────────────────────────────────

const validateDeliveryAddress = (
  deliveryAddress
) => {
  if (
    !deliveryAddress ||
    typeof deliveryAddress !==
      "object" ||
    Array.isArray(
      deliveryAddress
    )
  ) {
    throw createError(
      "Delivery address is required",
      400,
      "DELIVERY_ADDRESS_REQUIRED"
    );
  }

  if (
    !deliveryAddress.addressLine1 &&
    !deliveryAddress.fullAddress
  ) {
    throw createError(
      "Delivery address line is required",
      400,
      "DELIVERY_ADDRESS_LINE_REQUIRED"
    );
  }

  return deliveryAddress;
};

// ─── Order Number ───────────────────────────────────────────────────────────

const createUniqueOrderNumber =
  async () => {
    while (true) {
      const randomNumber =
        Math.floor(
          1000 +
            Math.random() * 9000
        );

      const timestampPart =
        Date.now()
          .toString()
          .slice(-10);

      const orderNumber =
        `AM${timestampPart}${randomNumber}`;

      const existingOrder =
        await prisma.order.findUnique(
          {
            where: {
              orderNumber,
            },

            select: {
              id: true,
            },
          }
        );

      if (!existingOrder) {
        return orderNumber;
      }
    }
  };

// ─── Cart Helpers ───────────────────────────────────────────────────────────

const getActiveUserCart = async (
  userId
) => {
  const cart =
    await prisma.cart.findFirst({
      where: {
        userId,
      },

      orderBy: {
        updatedAt: "desc",
      },

      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                nameAr: true,
                price: true,

                isActive: true,
                inStock: true,
                stockQuantity: true,
              },
            },
          },
        },
      },
    });

  if (
    !cart ||
    cart.items.length === 0
  ) {
    throw createError(
      "Cart is empty",
      400,
      "CART_EMPTY"
    );
  }

  return cart;
};

const validateCartItemsForOrder = (
  cartItems
) => {
  return cartItems.map(
    (item) => {
      if (!item.product) {
        throw createError(
          "One product in your cart no longer exists",
          400,
          "PRODUCT_NOT_FOUND"
        );
      }

      if (
        !item.product.isActive
      ) {
        throw createError(
          `${item.product.name} is no longer available`,
          400,
          "PRODUCT_INACTIVE"
        );
      }

      const availableQuantity =
        Number(
          item.product
            .stockQuantity || 0
        );

      const requestedQuantity =
        Number(
          item.quantity || 0
        );

      if (
        !item.product.inStock ||
        availableQuantity <= 0
      ) {
        throw createError(
          `${item.product.name} is out of stock`,
          400,
          "PRODUCT_OUT_OF_STOCK"
        );
      }

      if (
        requestedQuantity <= 0
      ) {
        throw createError(
          "Invalid cart item quantity",
          400,
          "INVALID_QUANTITY"
        );
      }

      if (
        requestedQuantity >
        availableQuantity
      ) {
        throw createError(
          `Only ${availableQuantity} units of ${item.product.name} are available`,
          400,
          "INSUFFICIENT_STOCK"
        );
      }

      const unitPrice =
        new Prisma.Decimal(
          item.unitPrice
        );

      if (
        unitPrice.isNegative() ||
        unitPrice.equals(0)
      ) {
        throw createError(
          "Invalid item price",
          400,
          "INVALID_ITEM_PRICE"
        );
      }

      return {
        productId:
          item.product.id,

        productName:
          item.product.name,

        productNameAr:
          item.product.nameAr,

        unitPrice,

        quantity:
          requestedQuantity,
      };
    }
  );
};

// ─── Create Order From Cart ─────────────────────────────────────────────────

const createOrderFromCart = async (
  user,
  {
    deliveryAddress,
    paymentMethod =
      PaymentMethod.CASH,
    notes,
    paymentId = null,
  }
) => {
  const userId = user.id;

  const normalizedDeliveryAddress =
    validateDeliveryAddress(
      deliveryAddress
    );

  const normalizedPaymentMethod =
    validatePaymentMethod(
      paymentMethod
    );

  const normalizedNotes =
    normalizeString(notes);

  const cart =
    await getActiveUserCart(
      userId
    );

  const orderItemsData =
    validateCartItemsForOrder(
      cart.items
    );

  const subtotal =
    orderItemsData.reduce(
      (sum, item) =>
        sum.plus(
          new Prisma.Decimal(
            item.unitPrice
          ).mul(
            item.quantity
          )
        ),

      new Prisma.Decimal(0)
    );

  const discountAmount =
    new Prisma.Decimal(0);

  const taxAmount =
    new Prisma.Decimal(0);

  const orderNumber =
    await createUniqueOrderNumber();

  return prisma.$transaction(
    async (tx) => {
      const deliveryFeeValue =
        await deliverySettingService
          .getDeliveryFee(tx);

      const totalAmount =
        subtotal
          .minus(
            discountAmount
          )
          .plus(
            taxAmount
          )
          .plus(
            deliveryFeeValue
          )
          .toDecimalPlaces(2);

      /*
       * Decrement stock atomically.
       * updateMany with gte prevents negative stock
       * when multiple customers order simultaneously.
       */
      for (
        const item of
        orderItemsData
      ) {
        const result =
          await tx.product.updateMany(
            {
              where: {
                id:
                  item.productId,

                isActive: true,
                inStock: true,

                stockQuantity: {
                  gte:
                    item.quantity,
                },
              },

              data: {
                stockQuantity: {
                  decrement:
                    item.quantity,
                },
              },
            }
          );

        if (
          result.count === 0
        ) {
          throw createError(
            `Insufficient stock for ${item.productName}`,
            409,
            "INSUFFICIENT_STOCK"
          );
        }
      }

      const createdOrder =
        await tx.order.create({
          data: {
            orderNumber,
            userId,

            customerEmail:
              user.email ||
              null,

            customerPhone:
              user.phone ||
              normalizedDeliveryAddress
                .phone ||
              null,

            status:
              OrderStatus.PENDING,

            paymentStatus:
              PaymentStatus.PENDING,

            paymentMethod:
              normalizedPaymentMethod,

            paymentId:
              paymentId ||
              null,

            subtotal:
              subtotal.toDecimalPlaces(
                2
              ),

            discountAmount,
            taxAmount,

            deliveryFee:
              deliveryFeeValue,

            totalAmount,

            notes:
              normalizedNotes,

            deliveryAddress:
              normalizedDeliveryAddress,

            items: {
              create:
                orderItemsData,
            },

            statusHistory: {
              create: {
                status:
                  OrderStatus.PENDING,

                notes:
                  "Order created",

                createdBy:
                  userId,
              },
            },
          },

          select:
            orderSelectForMobile,
        });

      /*
       * Disable products whose stock reached zero.
       */
      for (
        const item of
        orderItemsData
      ) {
        const product =
          await tx.product.findUnique(
            {
              where: {
                id:
                  item.productId,
              },

              select: {
                stockQuantity: true,
              },
            }
          );

        if (
          product &&
          product.stockQuantity <=
            0
        ) {
          await tx.product.update(
            {
              where: {
                id:
                  item.productId,
              },

              data: {
                inStock: false,
              },
            }
          );
        }
      }

      const customer =
        await tx.user.findUnique(
          {
            where: {
              id: userId,
            },

            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          }
        );

      await notificationService
        .createNewOrderNotification(
          tx,
          createdOrder,
          customer
        );

      /*
       * Clear cart only after the order has been
       * created successfully inside the transaction.
       */
      await tx.cartItem.deleteMany(
        {
          where: {
            cartId:
              cart.id,
          },
        }
      );

      return createdOrder;
    }
  );
};

// ─── Save Tap Charge ID ─────────────────────────────────────────────────────

const updateOrderPaymentId =
  async (
    orderId,
    paymentId
  ) => {
    if (!orderId) {
      throw createError(
        "Order ID is required",
        400,
        "ORDER_ID_REQUIRED"
      );
    }

    if (!paymentId) {
      throw createError(
        "Payment ID is required",
        400,
        "PAYMENT_ID_REQUIRED"
      );
    }

    const existingOrder =
      await prisma.order.findUnique(
        {
          where: {
            id: orderId,
          },

          select: {
            id: true,
            paymentMethod: true,
          },
        }
      );

    if (!existingOrder) {
      throw createError(
        "Order not found",
        404,
        "ORDER_NOT_FOUND"
      );
    }

    if (
      existingOrder.paymentMethod ===
      PaymentMethod.CASH
    ) {
      throw createError(
        "A Tap payment ID cannot be assigned to a cash order",
        400,
        "INVALID_PAYMENT_METHOD"
      );
    }

    return prisma.order.update({
      where: {
        id: orderId,
      },

      data: {
        paymentId:
          String(
            paymentId
          ).trim(),
      },

      select:
        orderSelectForMobile,
    });
  };

// ─── Tap Status Mapping ─────────────────────────────────────────────────────

const mapTapStatusToPaymentStatus =
  (tapStatus) => {
    const normalizedTapStatus =
      String(tapStatus || "")
        .trim()
        .toUpperCase();

    if (
      [
        "AUTHORIZED",
        "CAPTURED",
      ].includes(
        normalizedTapStatus
      )
    ) {
      return PaymentStatus.PAID;
    }

    if (
      [
        "FAILED",
        "DECLINED",
        "CANCELLED",
        "VOID",
        "ABANDONED",
        "TIMEDOUT",
        "RESTRICTED",
        "UNKNOWN",
      ].includes(
        normalizedTapStatus
      )
    ) {
      return PaymentStatus.FAILED;
    }

    return PaymentStatus.PENDING;
  };

// ─── Automatic Tap Payment Update ───────────────────────────────────────────

const updateOrderPaymentFromTap =
  async (
    paymentId,
    tapStatus
  ) => {
    if (!paymentId) {
      throw createError(
        "Payment ID is required",
        400,
        "PAYMENT_ID_REQUIRED"
      );
    }

    const paymentStatus =
      mapTapStatusToPaymentStatus(
        tapStatus
      );

    const existingOrder =
      await prisma.order.findFirst(
        {
          where: {
            paymentId,
          },

          select: {
            id: true,
            userId: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            paidAt: true,
          },
        }
      );

    if (!existingOrder) {
      throw createError(
        "Order not found for this payment",
        404,
        "ORDER_NOT_FOUND"
      );
    }

    /*
     * Tap must never modify a cash payment.
     */
    if (
      existingOrder.paymentMethod ===
      PaymentMethod.CASH
    ) {
      throw createError(
        "Tap payment update cannot be applied to a cash order",
        400,
        "INVALID_PAYMENT_METHOD"
      );
    }

    const shouldConfirmOrder =
      paymentStatus ===
        PaymentStatus.PAID &&
      existingOrder.status ===
        OrderStatus.PENDING;

    const paidAt =
      paymentStatus ===
      PaymentStatus.PAID
        ? existingOrder.paidAt ||
          new Date()
        : null;

    return prisma.order.update({
      where: {
        id:
          existingOrder.id,
      },

      data: {
        paymentStatus,
        paidAt,

        /*
         * A successful card payment confirms the
         * order automatically.
         */
        ...(shouldConfirmOrder
          ? {
              status:
                OrderStatus.CONFIRMED,

              statusHistory: {
                create: {
                  status:
                    OrderStatus.CONFIRMED,

                  notes:
                    "Order confirmed after successful card payment",

                  createdBy:
                    existingOrder.userId,
                },
              },
            }
          : {}),
      },

      select:
        orderSelectForAdmin,
    });
  };

// ─── Mobile Order Queries ───────────────────────────────────────────────────

const getMyOrders = async (
  userId,
  {
    page = 1,
    limit =
      DEFAULT_MOBILE_LIMIT,
  } = {}
) => {
  const {
    pageNumber,
    limitNumber,
    skip,
  } = getPagination({
    page,
    limit,
  });

  const [orders, total] =
    await Promise.all([
      prisma.order.findMany({
        where: {
          userId,
        },

        skip,
        take:
          limitNumber,

        orderBy: {
          createdAt:
            "desc",
        },

        select:
          orderSelectForMobile,
      }),

      prisma.order.count({
        where: {
          userId,
        },
      }),
    ]);

  return {
    data: orders,

    pagination: {
      total,
      page:
        pageNumber,
      limit:
        limitNumber,

      totalPages:
        Math.ceil(
          total /
            limitNumber
        ),
    },
  };
};

const getMyOrderById = async (
  userId,
  orderId
) => {
  const order =
    await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },

      select:
        orderSelectForMobile,
    });

  if (!order) {
    throw createError(
      "Order not found",
      404,
      "ORDER_NOT_FOUND"
    );
  }

  return order;
};

// ─── Admin Order Queries ────────────────────────────────────────────────────

const getAllOrdersForAdmin =
  async ({
    page = 1,
    limit =
      DEFAULT_ADMIN_LIMIT,
    search,
    status,
    paymentStatus,
  } = {}) => {
    const {
      pageNumber,
      limitNumber,
      skip,
    } = getPagination({
      page,
      limit,
    });

    const searchText =
      typeof search ===
      "string"
        ? search.trim()
        : "";

    const normalizedStatus =
      status
        ? validateOrderStatus(
            status
          )
        : undefined;

    const normalizedPaymentStatus =
      paymentStatus
        ? validatePaymentStatus(
            paymentStatus
          )
        : undefined;

    const where = {
      ...(normalizedStatus
        ? {
            status:
              normalizedStatus,
          }
        : {}),

      ...(normalizedPaymentStatus
        ? {
            paymentStatus:
              normalizedPaymentStatus,
          }
        : {}),

      ...(searchText
        ? {
            OR: [
              {
                orderNumber: {
                  contains:
                    searchText,

                  mode:
                    "insensitive",
                },
              },

              {
                customerEmail: {
                  contains:
                    searchText,

                  mode:
                    "insensitive",
                },
              },

              {
                customerPhone: {
                  contains:
                    searchText,

                  mode:
                    "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const [orders, total] =
      await Promise.all([
        prisma.order.findMany({
          where,
          skip,
          take:
            limitNumber,

          orderBy: {
            createdAt:
              "desc",
          },

          select:
            orderSelectForAdmin,
        }),

        prisma.order.count({
          where,
        }),
      ]);

    return {
      data: orders,

      pagination: {
        total,
        page:
          pageNumber,
        limit:
          limitNumber,

        totalPages:
          Math.ceil(
            total /
              limitNumber
          ),
      },
    };
  };

const getOrderByIdForAdmin =
  async (orderId) => {
    const order =
      await prisma.order.findUnique(
        {
          where: {
            id:
              orderId,
          },

          select:
            orderSelectForAdmin,
        }
      );

    if (!order) {
      throw createError(
        "Order not found",
        404,
        "ORDER_NOT_FOUND"
      );
    }

    return order;
  };

// ─── Admin Order Status Update ──────────────────────────────────────────────

const updateOrderStatus =
  async (
    orderId,
    {
      status,
      notes,
    },
    actor
  ) => {
    const normalizedStatus =
      validateOrderStatus(
        status
      );

    const existingOrder =
      await prisma.order.findUnique(
        {
          where: {
            id:
              orderId,
          },

          select: {
            id: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
          },
        }
      );

    if (!existingOrder) {
      throw createError(
        "Order not found",
        404,
        "ORDER_NOT_FOUND"
      );
    }

    validateStatusTransition(
      existingOrder.status,
      normalizedStatus
    );

    validateStatusPermission(
      normalizedStatus,
      actor?.role
    );

    /*
     * A cash order cannot be delivered before
     * an admin marks its payment as paid.
     */
    if (
      normalizedStatus ===
        OrderStatus.DELIVERED &&
      existingOrder.paymentMethod ===
        PaymentMethod.CASH &&
      existingOrder.paymentStatus !==
        PaymentStatus.PAID
    ) {
      throw createError(
        "Cash payment must be marked as paid before delivering the order",
        400,
        "CASH_PAYMENT_NOT_PAID"
      );
    }

    return prisma.order.update({
      where: {
        id:
          orderId,
      },

      data: {
        status:
          normalizedStatus,

        ...(normalizedStatus ===
        OrderStatus.DELIVERED
          ? {
              actualDeliveryTime:
                new Date(),
            }
          : {}),

        statusHistory: {
          create: {
            status:
              normalizedStatus,

            notes:
              normalizeString(
                notes
              ),

            createdBy:
              actor.id,
          },
        },
      },

      select:
        orderSelectForAdmin,
    });
  };

// ─── Manual Payment Status Update: CASH ONLY ────────────────────────────────

const updatePaymentStatus =
  async (
    orderId,
    paymentStatus,
    actor
  ) => {
    const normalizedStatus =
      validatePaymentStatus(
        paymentStatus
      );

    const existingOrder =
      await prisma.order.findUnique(
        {
          where: {
            id:
              orderId,
          },

          select: {
            id: true,
            paymentStatus: true,
            paymentMethod: true,
            paidAt: true,
          },
        }
      );

    if (!existingOrder) {
      throw createError(
        "Order not found",
        404,
        "ORDER_NOT_FOUND"
      );
    }

    const normalizedRole =
      String(
        actor?.role || ""
      ).toUpperCase();

    if (
      normalizedRole !==
      "ADMIN"
    ) {
      throw createError(
        "Only admins can update payment status",
        403,
        "PAYMENT_STATUS_PERMISSION_DENIED"
      );
    }

    /*
     * Cash payments are updated manually.
     * Card payment status is controlled by Tap.
     */
    if (
      existingOrder.paymentMethod !==
      PaymentMethod.CASH
    ) {
      throw createError(
        "Card payment status is updated automatically by Tap",
        400,
        "CARD_PAYMENT_STATUS_AUTOMATIC"
      );
    }

    validatePaymentStatusTransition(
      existingOrder.paymentStatus,
      normalizedStatus
    );

    let paidAt =
      existingOrder.paidAt;

    if (
      normalizedStatus ===
      PaymentStatus.PAID
    ) {
      paidAt =
        existingOrder.paidAt ||
        new Date();
    }

    if (
      normalizedStatus ===
        PaymentStatus.PENDING ||
      normalizedStatus ===
        PaymentStatus.FAILED
    ) {
      paidAt = null;
    }

    return prisma.order.update({
      where: {
        id:
          orderId,
      },

      data: {
        paymentStatus:
          normalizedStatus,

        paidAt,
      },

      select:
        orderSelectForAdmin,
    });
  };

// ─── Mark Cash Order As Paid ────────────────────────────────────────────────

const markCashOrderAsPaid =
  async (orderId) => {
    const existingOrder =
      await prisma.order.findUnique(
        {
          where: {
            id:
              orderId,
          },

          select: {
            id: true,
            paymentMethod: true,
            paymentStatus: true,
          },
        }
      );

    if (!existingOrder) {
      throw createError(
        "Order not found",
        404,
        "ORDER_NOT_FOUND"
      );
    }

    if (
      existingOrder.paymentMethod !==
      PaymentMethod.CASH
    ) {
      throw createError(
        "Only cash orders can be manually marked as paid",
        400,
        "NOT_A_CASH_ORDER"
      );
    }

    if (
      existingOrder.paymentStatus ===
      PaymentStatus.PAID
    ) {
      return getOrderByIdForAdmin(
        orderId
      );
    }

    validatePaymentStatusTransition(
      existingOrder.paymentStatus,
      PaymentStatus.PAID
    );

    return prisma.order.update({
      where: {
        id:
          orderId,
      },

      data: {
        paymentStatus:
          PaymentStatus.PAID,

        paidAt:
          new Date(),
      },

      select:
        orderSelectForAdmin,
    });
  };

// ─── Find Order By Tap Charge ID ────────────────────────────────────────────

const getOrderByPaymentId =
  async (paymentId) => {
    const normalizedPaymentId =
      String(
        paymentId || ""
      ).trim();

    if (
      !normalizedPaymentId
    ) {
      throw createError(
        "Payment ID is required",
        400,
        "PAYMENT_ID_REQUIRED"
      );
    }

    return prisma.order.findFirst({
      where: {
        paymentId:
          normalizedPaymentId,
      },

      select:
        orderSelectForPayment,
    });
  };

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  createOrderFromCart,

  getMyOrders,
  getMyOrderById,

  getAllOrdersForAdmin,
  getOrderByIdForAdmin,

  updateOrderStatus,

  /*
   * Manual payment update for cash orders only.
   */
  updatePaymentStatus,
  markCashOrderAsPaid,

  /*
   * Automatic card payment functions used by Tap.
   */
  updateOrderPaymentId,
  updateOrderPaymentFromTap,
  getOrderByPaymentId,
};