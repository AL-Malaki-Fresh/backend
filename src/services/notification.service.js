const {
  AdminNotificationType,
  Prisma,
} = require("@prisma/client");

const prisma = require("../config/prisma");

const createError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const toAmountString = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "0.00";
  }

  try {
    return new Prisma.Decimal(value)
      .toDecimalPlaces(2)
      .toString();
  } catch {
    return value?.toString
      ? value.toString()
      : String(value);
  }
};

const getAddressText = (deliveryAddress) => {
  if (
    !deliveryAddress ||
    typeof deliveryAddress !== "object" ||
    Array.isArray(deliveryAddress)
  ) {
    return null;
  }

  return (
    deliveryAddress.fullAddress ||
    deliveryAddress.addressLine1 ||
    deliveryAddress.address ||
    null
  );
};

const getFullAddress = (deliveryAddress) => {
  if (
    !deliveryAddress ||
    typeof deliveryAddress !== "object" ||
    Array.isArray(deliveryAddress)
  ) {
    return null;
  }

  return (
    deliveryAddress.fullAddress ||
    [
      deliveryAddress.addressLine1,
      deliveryAddress.addressLine2,
      deliveryAddress.city,
      deliveryAddress.country,
    ]
      .filter(Boolean)
      .join(", ") ||
    deliveryAddress.address ||
    null
  );
};

const getCustomerArabicName = (deliveryAddress) => {
  if (
    !deliveryAddress ||
    typeof deliveryAddress !== "object" ||
    Array.isArray(deliveryAddress)
  ) {
    return null;
  }

  return (
    deliveryAddress.customerNameAr ||
    deliveryAddress.fullNameAr ||
    deliveryAddress.nameAr ||
    null
  );
};

const calculateLineTotal = (
  unitPrice,
  quantity
) => {
  try {
    return new Prisma.Decimal(
      unitPrice ?? 0
    )
      .mul(Number(quantity ?? 0))
      .toDecimalPlaces(2)
      .toString();
  } catch {
    return "0.00";
  }
};

const normalizeInvoiceItems = (
  items = []
) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    const unitPrice =
      toAmountString(
        item.unitPrice ??
          item.product?.price ??
          0
      );

    const quantity =
      Number(item.quantity ?? 0);

    return {
      productId:
        item.productId ??
        item.product?.id ??
        null,

      productName:
        item.productName ??
        item.product?.name ??
        null,

      productNameAr:
        item.productNameAr ??
        item.product?.nameAr ??
        null,

      unitPrice,

      quantity,

      lineTotal:
        item.lineTotal !== undefined &&
        item.lineTotal !== null
          ? toAmountString(
              item.lineTotal
            )
          : calculateLineTotal(
              unitPrice,
              quantity
            ),
    };
  });
};

const buildInvoice = (order) => {
  const items =
    normalizeInvoiceItems(
      order?.invoice?.items ??
        order?.items ??
        []
    );

  return {
    items,

    subtotal:
      toAmountString(
        order?.invoice?.subtotal ??
          order?.subtotal
      ),

    discountAmount:
      toAmountString(
        order?.invoice
          ?.discountAmount ??
          order?.discountAmount
      ),

    taxAmount:
      toAmountString(
        order?.invoice?.taxAmount ??
          order?.taxAmount
      ),

    deliveryFee:
      toAmountString(
        order?.invoice?.deliveryFee ??
          order?.deliveryFee
      ),

    totalAmount:
      toAmountString(
        order?.invoice?.totalAmount ??
          order?.totalAmount
      ),

    paymentMethod:
      order?.invoice?.paymentMethod ??
      order?.paymentMethod ??
      null,

    paymentStatus:
      order?.invoice?.paymentStatus ??
      order?.paymentStatus ??
      null,
  };
};

const createNewOrderNotification = async (
  tx,
  order,
  customer
) => {
  const db = tx || prisma;

  if (!order) {
    throw createError(
      "Order is required to create a notification",
      400,
      "ORDER_REQUIRED"
    );
  }

  const deliveryAddress =
    order.deliveryAddress &&
    typeof order.deliveryAddress ===
      "object" &&
    !Array.isArray(
      order.deliveryAddress
    )
      ? order.deliveryAddress
      : {};

  const customerFirstName =
    customer?.firstName ??
    deliveryAddress.firstName ??
    null;

  const customerLastName =
    customer?.lastName ??
    deliveryAddress.lastName ??
    null;

  const customerFullName =
    [
      customerFirstName,
      customerLastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    deliveryAddress.fullName ||
    deliveryAddress.customerName ||
    order.customerEmail ||
    order.customerPhone ||
    "Customer";

  const customerEmail =
    customer?.email ??
    order.customerEmail ??
    deliveryAddress.email ??
    null;

  const customerPhone =
    customer?.phone ??
    order.customerPhone ??
    deliveryAddress.phone ??
    null;

  const fullAddress =
    getFullAddress(
      deliveryAddress
    ) ||
    getAddressText(
      deliveryAddress
    );

  const customerArabicName =
    getCustomerArabicName(
      deliveryAddress
    );

  const invoice =
    buildInvoice(order);

  return db.adminNotification.create({
    data: {
      type:
        AdminNotificationType.NEW_ORDER,

      title:
        "New order received",

      message:
        `New order ${order.orderNumber} ` +
        `from ${customerFullName}`,

      data: {
        orderId:
          order.id,

        orderNumber:
          order.orderNumber,

        createdAt:
          order.createdAt
            ? new Date(
                order.createdAt
              ).toISOString()
            : new Date().toISOString(),

        customer: {
          id:
            customer?.id ??
            order.userId ??
            null,

          firstName:
            customerFirstName,

          lastName:
            customerLastName,

          fullName:
            customerFullName,

          email:
            customerEmail,

          phone:
            customerPhone,

          arabicName:
            customerArabicName,
        },

        deliveryAddress: {
          addressLine1:
            deliveryAddress
              .addressLine1 ??
            null,

          addressLine2:
            deliveryAddress
              .addressLine2 ??
            null,

          fullAddress:
            fullAddress ?? null,

          city:
            deliveryAddress.city ??
            null,

          country:
            deliveryAddress.country ??
            null,

          phone:
            deliveryAddress.phone ??
            customerPhone ??
            null,

          latitude:
            deliveryAddress.latitude ??
            null,

          longitude:
            deliveryAddress.longitude ??
            null,
        },

        items:
          invoice.items,

        invoice: {
          items:
            invoice.items,

          subtotal:
            invoice.subtotal,

          discountAmount:
            invoice.discountAmount,

          taxAmount:
            invoice.taxAmount,

          deliveryFee:
            invoice.deliveryFee,

          totalAmount:
            invoice.totalAmount,

          paymentMethod:
            invoice.paymentMethod,

          paymentStatus:
            invoice.paymentStatus,
        },

        subtotal:
          invoice.subtotal,

        discountAmount:
          invoice.discountAmount,

        taxAmount:
          invoice.taxAmount,

        deliveryFee:
          invoice.deliveryFee,

        totalAmount:
          invoice.totalAmount,

        paymentMethod:
          invoice.paymentMethod,

        paymentStatus:
          invoice.paymentStatus,

        status:
          order.status ?? null,
      },

      isRead: false,
    },
  });
};

const getAdminNotifications = async ({
  page = 1,
  limit = 20,
  isRead,
} = {}) => {
  const rawPage =
    Number(page);

  const rawLimit =
    Number(limit);

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
          100
        )
      : 20;

  const skip =
    (pageNumber - 1) *
    limitNumber;

  const readFilter =
    isRead === true ||
    isRead === "true"
      ? true
      : isRead === false ||
        isRead === "false"
      ? false
      : undefined;

  const where = {
    ...(readFilter !==
    undefined
      ? {
          isRead:
            readFilter,
        }
      : {}),
  };

  const [
    notifications,
    total,
  ] = await Promise.all([
    prisma.adminNotification
      .findMany({
        where,

        orderBy: {
          createdAt:
            "desc",
        },

        skip,

        take:
          limitNumber,
      }),

    prisma.adminNotification
      .count({
        where,
      }),
  ]);

  return {
    data:
      notifications,

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

const getUnreadNotificationsCount =
  async () => {
    return prisma
      .adminNotification
      .count({
        where: {
          isRead: false,
        },
      });
  };

const markNotificationAsRead =
  async (id) => {
    const notification =
      await prisma
        .adminNotification
        .findUnique({
          where: {
            id,
          },
        });

    if (!notification) {
      throw createError(
        "Notification not found",
        404,
        "NOTIFICATION_NOT_FOUND"
      );
    }

    return prisma
      .adminNotification
      .update({
        where: {
          id,
        },

        data: {
          isRead: true,

          readAt:
            new Date(),
        },
      });
  };
// NOTE: there used to be an `updatePaymentStatus` here that referenced
// `order.payment` / `order.customer` relations and an `updatedById` field
// that don't exist in schema.prisma — it was never called (the real,
// working implementation admin/order.controller.js actually uses is
// order.service.js's `updatePaymentStatus`), so this was dead code that
// would only have blown up if someone wired it in later without checking
// the schema. Removed.
const markAllNotificationsAsRead =
  async () => {
    await prisma
      .adminNotification
      .updateMany({
        where: {
          isRead: false,
        },

        data: {
          isRead: true,

          readAt:
            new Date(),
        },
      });

    return {
      message:
        "All notifications marked as read",
    };
  };

const getAdminNotificationById =
  async (id) => {
    const notification =
      await prisma
        .adminNotification
        .findUnique({
          where: {
            id,
          },
        });

    if (!notification) {
      throw createError(
        "Notification not found",
        404,
        "NOTIFICATION_NOT_FOUND"
      );
    }

    return notification;
  };

module.exports = {
  createNewOrderNotification,
  getAdminNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getAdminNotificationById,
};