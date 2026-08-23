// backend/src/services/cart.service.js

const { Prisma } = require("@prisma/client");

const prisma = require("../config/prisma");

const MAX_CART_QUANTITY = 99;

const createError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const cartItemSelect = {
  id: true,
  productId: true,
  variantId: true,
  quantity: true,
  unitPrice: true,
  addedAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      name: true,
      nameAr: true,
      slug: true,
      price: true,
      comparePrice: true,
      imageUrl: true,
      galleryImages: true,
      inStock: true,
      isActive: true,
      unitLabel: true,
      weight: true,
      weightUnit: true,
      category: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          slug: true,
        },
      },
    },
  },
};

const cartSelect = {
  id: true,
  userId: true,
  sessionId: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: {
      addedAt: "desc",
    },
    select: cartItemSelect,
  },
};

const normalizeQuantity = (quantity) => {
  const quantityValue = Number(quantity);

  if (
    !Number.isInteger(quantityValue) ||
    quantityValue <= 0 ||
    quantityValue > MAX_CART_QUANTITY
  ) {
    throw createError(
      `Quantity must be between 1 and ${MAX_CART_QUANTITY}`,
      400,
      "INVALID_QUANTITY"
    );
  }

  return quantityValue;
};

const calculateCartSummary = (cart) => {
  const subtotal = cart.items.reduce((sum, item) => {
    return sum.plus(new Prisma.Decimal(item.unitPrice).mul(item.quantity));
  }, new Prisma.Decimal(0));

  const totalQuantity = cart.items.reduce((sum, item) => {
    return sum + item.quantity;
  }, 0);

  return {
    subtotal: subtotal.toDecimalPlaces(2).toString(),
    totalQuantity,
    itemsCount: cart.items.length,
  };
};

const formatCartResponse = (cart) => {
  return {
    ...cart,
    summary: calculateCartSummary(cart),
  };
};

const getOrCreateUserCart = async (userId) => {
  let cart = await prisma.cart.findFirst({
    where: {
      userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        userId,
        sessionId: null,
      },
      select: {
        id: true,
      },
    });
  }

  return cart;
};

const getProductForCart = async (productId) => {
  if (!productId) {
    throw createError("Product is required", 400, "PRODUCT_REQUIRED");
  }

  const product = await prisma.product.findUnique({
    where: {
      id: productId,
    },
    select: {
      id: true,
      price: true,
      isActive: true,
      inStock: true,
      name: true,
    },
  });

  if (!product) {
    throw createError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  if (!product.isActive) {
    throw createError(
      "Product is not available",
      400,
      "PRODUCT_NOT_AVAILABLE"
    );
  }

  if (!product.inStock) {
    throw createError("Product is out of stock", 400, "PRODUCT_OUT_OF_STOCK");
  }

  return product;
};

const getMyCart = async (userId) => {
  const cart = await getOrCreateUserCart(userId);

  const fullCart = await prisma.cart.findUnique({
    where: {
      id: cart.id,
    },
    select: cartSelect,
  });

  return formatCartResponse(fullCart);
};

const addItemToCart = async (userId, { productId, quantity = 1 }) => {
  const quantityValue = normalizeQuantity(quantity);
  const product = await getProductForCart(productId);
  const cart = await getOrCreateUserCart(userId);

  await prisma.$transaction(async (tx) => {
    const existingItem = await tx.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: product.id,
        variantId: null,
      },
      select: {
        id: true,
        quantity: true,
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantityValue;

      if (newQuantity > MAX_CART_QUANTITY) {
        throw createError(
          `Quantity cannot exceed ${MAX_CART_QUANTITY}`,
          400,
          "MAX_CART_QUANTITY_EXCEEDED"
        );
      }

      await tx.cartItem.update({
        where: {
          id: existingItem.id,
        },
        data: {
          quantity: newQuantity,
          unitPrice: product.price,
        },
      });

      return;
    }

    await tx.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        variantId: null,
        quantity: quantityValue,
        unitPrice: product.price,
      },
    });
  });

  return getMyCart(userId);
};

const updateCartItemQuantity = async (userId, itemId, { quantity }) => {
  const quantityValue = normalizeQuantity(quantity);

  const cartItem = await prisma.cartItem.findFirst({
    where: {
      id: itemId,
      cart: {
        userId,
      },
    },
    select: {
      id: true,
      productId: true,
      product: {
        select: {
          id: true,
          price: true,
          isActive: true,
          inStock: true,
          name: true,
        },
      },
    },
  });

  if (!cartItem) {
    throw createError("Cart item not found", 404, "CART_ITEM_NOT_FOUND");
  }

  if (!cartItem.product) {
    throw createError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  if (!cartItem.product.isActive) {
    throw createError(
      "Product is not available",
      400,
      "PRODUCT_NOT_AVAILABLE"
    );
  }

  if (!cartItem.product.inStock) {
    throw createError("Product is out of stock", 400, "PRODUCT_OUT_OF_STOCK");
  }

  await prisma.cartItem.update({
    where: {
      id: itemId,
    },
    data: {
      quantity: quantityValue,
      unitPrice: cartItem.product.price,
    },
  });

  return getMyCart(userId);
};

// ✅ FIXED: Remove cart item
const removeCartItem = async (userId, itemId) => {
  console.log(`🗑️ Attempting to remove cart item ${itemId} for user ${userId}`);

  // ✅ First, find the cart item and verify it belongs to the user
  const cartItem = await prisma.cartItem.findFirst({
    where: {
      id: itemId,
      cart: {
        userId,
      },
    },
    select: {
      id: true,
      cartId: true,
    },
  });

  if (!cartItem) {
    console.log(`⚠️ Cart item ${itemId} not found for user ${userId}`);
    throw createError("Cart item not found", 404, "CART_ITEM_NOT_FOUND");
  }

  // ✅ Delete the cart item
  await prisma.cartItem.delete({
    where: {
      id: itemId,
    },
  });

  console.log(`✅ Cart item ${itemId} removed successfully`);

  // ✅ Return the updated cart
  return getMyCart(userId);
};

const clearMyCart = async (userId) => {
  const cart = await getOrCreateUserCart(userId);

  await prisma.cartItem.deleteMany({
    where: {
      cartId: cart.id,
    },
  });

  return getMyCart(userId);
};

module.exports = {
  getMyCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearMyCart,
};