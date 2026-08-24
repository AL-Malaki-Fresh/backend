const prisma = require("../config/prisma");

const MAX_LIMIT = 100;
const DEFAULT_ADMIN_LIMIT = 10;
const DEFAULT_MOBILE_LIMIT = 20;

const createError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const productSelectForAdmin = {
  id: true,
  name: true,
  nameAr: true,
  slug: true,
  description: true,
  descriptionAr: true,
  price: true,
  comparePrice: true,
  costPrice: true,
  sku: true,
  barcode: true,
  imageUrl: true,
  galleryImages: true,
  isFresh: true,
  inStock: true,
  stockQuantity: true,
  lowStockThreshold: true,
  brand: true,
  weight: true,
  weightUnit: true,
  unitLabel: true,
  isFeatured: true,
  isActive: true,
  viewCount: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,

  category: {
    select: {
      id: true,
      name: true,
      nameAr: true,
      slug: true,
    },
  },
};

const productSelectForMobile = {
  id: true,
  name: true,
  nameAr: true,
  slug: true,
  description: true,
  descriptionAr: true,
  price: true,
  comparePrice: true,
  imageUrl: true,
  galleryImages: true,
  isFresh: true,
  inStock: true,
  stockQuantity: true,
  lowStockThreshold: true,
  brand: true,
  weight: true,
  weightUnit: true,
  unitLabel: true,
  isFeatured: true,
  categoryId: true,

  category: {
    select: {
      id: true,
      name: true,
      nameAr: true,
      slug: true,
    },
  },
};

const normalizeString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmedValue = String(value).trim();

  return trimmedValue || null;
};

const normalizeNumber = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return undefined;
  }

  return numberValue;
};

const parseBoolean = (value) => {
  if (value === undefined) return undefined;

  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  return undefined;
};

const getPagination = ({
  page = 1,
  limit = 10,
} = {}) => {
  const rawPage = Number(page);
  const rawLimit = Number(limit);

  const pageNumber =
    Number.isFinite(rawPage) && rawPage > 0
      ? Math.floor(rawPage)
      : 1;

  const limitNumber =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(
          Math.floor(rawLimit),
          MAX_LIMIT
        )
      : 10;

  const skip =
    (pageNumber - 1) * limitNumber;

  return {
    pageNumber,
    limitNumber,
    skip,
  };
};

const validateBooleanQuery = (
  fieldName,
  originalValue,
  parsedValue,
  code
) => {
  if (
    originalValue !== undefined &&
    parsedValue === undefined
  ) {
    throw createError(
      `${fieldName} must be true or false`,
      400,
      code
    );
  }
};

const validatePositiveOrZero = (
  fieldName,
  value,
  code
) => {
  const numberValue = normalizeNumber(value);

  if (
    numberValue === undefined ||
    numberValue < 0
  ) {
    throw createError(
      `${fieldName} must be a valid positive number`,
      400,
      code
    );
  }

  return numberValue;
};

const validateOptionalPositiveOrZero = (
  fieldName,
  value,
  code
) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const numberValue = normalizeNumber(value);

  if (
    numberValue === undefined ||
    numberValue < 0
  ) {
    throw createError(
      `${fieldName} must be a valid positive number`,
      400,
      code
    );
  }

  return numberValue;
};

const normalizeGalleryImages = (
  galleryImages
) => {
  if (galleryImages === undefined) {
    return undefined;
  }

  if (galleryImages === null) {
    return [];
  }

  if (Array.isArray(galleryImages)) {
    return galleryImages
      .map((image) =>
        String(image).trim()
      )
      .filter(Boolean);
  }

  if (typeof galleryImages === "string") {
    return galleryImages
      .split(/[,\n]/)
      .map((image) => image.trim())
      .filter(Boolean);
  }

  return [];
};

const generateSlug = (text) => {
  const slug = String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `product-${Date.now()}`;
};

const createUniqueSlug = async (
  name,
  currentProductId = null
) => {
  const baseSlug = generateSlug(name);

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existingProduct =
      await prisma.product.findFirst({
        where: {
          slug,

          ...(currentProductId
            ? {
                id: {
                  not: currentProductId,
                },
              }
            : {}),
        },

        select: {
          id: true,
        },
      });

    if (!existingProduct) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
};

const validateCategory = async (
  categoryId
) => {
  if (!categoryId) {
    throw createError(
      "Category is required",
      400,
      "CATEGORY_REQUIRED"
    );
  }

  const category =
    await prisma.category.findUnique({
      where: {
        id: categoryId,
      },

      select: {
        id: true,
      },
    });

  if (!category) {
    throw createError(
      "Category not found",
      404,
      "CATEGORY_NOT_FOUND"
    );
  }

  return category;
};

const findProductOrFail = async (id) => {
  const product =
    await prisma.product.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
      },
    });

  if (!product) {
    throw createError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  return product;
};

const createProduct = async ({
  name,
  nameAr,
  description,
  descriptionAr,
  price,
  comparePrice,
  costPrice,
  sku,
  barcode,
  imageUrl,
  galleryImages,
  isFresh = true,
  inStock = true,
  stockQuantity = 0,
  lowStockThreshold = 5,
  brand,
  weight,
  weightUnit,
  unitLabel,
  isFeatured = false,
  isActive = true,
  categoryId,
}) => {
  const normalizedName =
    normalizeString(name);

  const normalizedNameAr =
    normalizeString(nameAr);

  if (!normalizedName) {
    throw createError(
      "Product name is required",
      400,
      "PRODUCT_NAME_REQUIRED"
    );
  }

  if (!normalizedNameAr) {
    throw createError(
      "Arabic product name is required",
      400,
      "PRODUCT_ARABIC_NAME_REQUIRED"
    );
  }

  const priceValue =
    validatePositiveOrZero(
      "price",
      price,
      "INVALID_PRODUCT_PRICE"
    );

  const comparePriceValue =
    validateOptionalPositiveOrZero(
      "comparePrice",
      comparePrice,
      "INVALID_COMPARE_PRICE"
    );

  const costPriceValue =
    validateOptionalPositiveOrZero(
      "costPrice",
      costPrice,
      "INVALID_COST_PRICE"
    );

  const weightValue =
    validateOptionalPositiveOrZero(
      "weight",
      weight,
      "INVALID_WEIGHT"
    );

  const stockQuantityValue =
    validatePositiveOrZero(
      "stockQuantity",
      stockQuantity,
      "INVALID_STOCK_QUANTITY"
    );

  const lowStockThresholdValue =
    validatePositiveOrZero(
      "lowStockThreshold",
      lowStockThreshold,
      "INVALID_LOW_STOCK_THRESHOLD"
    );

  const freshValue =
    parseBoolean(isFresh);

  const requestedStockValue =
    parseBoolean(inStock);

  const featuredValue =
    parseBoolean(isFeatured);

  const activeValue =
    parseBoolean(isActive);

  validateBooleanQuery(
    "isFresh",
    isFresh,
    freshValue,
    "INVALID_FRESH_STATUS"
  );

  validateBooleanQuery(
    "inStock",
    inStock,
    requestedStockValue,
    "INVALID_STOCK_STATUS"
  );

  validateBooleanQuery(
    "isFeatured",
    isFeatured,
    featuredValue,
    "INVALID_FEATURED_STATUS"
  );

  validateBooleanQuery(
    "isActive",
    isActive,
    activeValue,
    "INVALID_ACTIVE_STATUS"
  );

  await validateCategory(categoryId);

  const slug =
    await createUniqueSlug(normalizedName);

  const calculatedInStock =
    stockQuantityValue > 0 &&
    requestedStockValue !== false;

  return prisma.product.create({
    data: {
      name: normalizedName,
      nameAr: normalizedNameAr,
      slug,

      description:
        normalizeString(description),

      descriptionAr:
        normalizeString(descriptionAr),

      price: priceValue,
      comparePrice: comparePriceValue,
      costPrice: costPriceValue,

      sku: normalizeString(sku),
      barcode: normalizeString(barcode),
      imageUrl: normalizeString(imageUrl),

      galleryImages:
        normalizeGalleryImages(
          galleryImages
        ) || [],

      isFresh: freshValue,
      inStock: calculatedInStock,
      stockQuantity:
        stockQuantityValue,

      lowStockThreshold:
        lowStockThresholdValue,

      brand: normalizeString(brand),
      weight: weightValue,
      weightUnit:
        normalizeString(weightUnit),

      unitLabel:
        normalizeString(unitLabel),

      isFeatured: featuredValue,
      isActive: activeValue,
      categoryId,
    },

    select: productSelectForAdmin,
  });
};

const getAllProductsForAdmin = async ({
  page = 1,
  limit = DEFAULT_ADMIN_LIMIT,
  search,
  categoryId,
  isActive,
  inStock,
  isFeatured,
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
    typeof search === "string"
      ? search.trim()
      : "";

  const activeFilter =
    parseBoolean(isActive);

  const stockFilter =
    parseBoolean(inStock);

  const featuredFilter =
    parseBoolean(isFeatured);

  validateBooleanQuery(
    "isActive",
    isActive,
    activeFilter,
    "INVALID_ACTIVE_STATUS"
  );

  validateBooleanQuery(
    "inStock",
    inStock,
    stockFilter,
    "INVALID_STOCK_STATUS"
  );

  validateBooleanQuery(
    "isFeatured",
    isFeatured,
    featuredFilter,
    "INVALID_FEATURED_STATUS"
  );

  const where = {
    ...(categoryId
      ? {
          categoryId,
        }
      : {}),

    ...(activeFilter !== undefined
      ? {
          isActive: activeFilter,
        }
      : {}),

    ...(stockFilter !== undefined
      ? {
          inStock: stockFilter,
        }
      : {}),

    ...(featuredFilter !== undefined
      ? {
          isFeatured: featuredFilter,
        }
      : {}),

    ...(searchText
      ? {
          OR: [
            {
              name: {
                contains: searchText,
                mode: "insensitive",
              },
            },
            {
              nameAr: {
                contains: searchText,
                mode: "insensitive",
              },
            },
            {
              slug: {
                contains: searchText,
                mode: "insensitive",
              },
            },
            {
              sku: {
                contains: searchText,
                mode: "insensitive",
              },
            },
            {
              barcode: {
                contains: searchText,
                mode: "insensitive",
              },
            },
            {
              brand: {
                contains: searchText,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const [products, total] =
    await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limitNumber,

        orderBy: [
          {
            isFeatured: "desc",
          },
          {
            createdAt: "desc",
          },
        ],

        select: productSelectForAdmin,
      }),

      prisma.product.count({
        where,
      }),
    ]);

  return {
    data: products,

    pagination: {
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(
        total / limitNumber
      ),
    },
  };
};

const getProductByIdForAdmin = async (
  id
) => {
  const product =
    await prisma.product.findUnique({
      where: {
        id,
      },

      select: productSelectForAdmin,
    });

  if (!product) {
    throw createError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  return product;
};

const updateProduct = async (
  id,
  {
    name,
    nameAr,
    description,
    descriptionAr,
    price,
    comparePrice,
    costPrice,
    sku,
    barcode,
    imageUrl,
    galleryImages,
    isFresh,
    inStock,
    stockQuantity,
    lowStockThreshold,
    brand,
    weight,
    weightUnit,
    unitLabel,
    isFeatured,
    isActive,
    categoryId,
  }
) => {
  await findProductOrFail(id);

  const normalizedName =
    name !== undefined
      ? normalizeString(name)
      : undefined;

  const normalizedNameAr =
    nameAr !== undefined
      ? normalizeString(nameAr)
      : undefined;

  if (
    name !== undefined &&
    !normalizedName
  ) {
    throw createError(
      "Product name cannot be empty",
      400,
      "PRODUCT_NAME_REQUIRED"
    );
  }

  if (
    nameAr !== undefined &&
    !normalizedNameAr
  ) {
    throw createError(
      "Arabic product name cannot be empty",
      400,
      "PRODUCT_ARABIC_NAME_REQUIRED"
    );
  }

  const priceValue =
    validateOptionalPositiveOrZero(
      "price",
      price,
      "INVALID_PRODUCT_PRICE"
    );

  const comparePriceValue =
    validateOptionalPositiveOrZero(
      "comparePrice",
      comparePrice,
      "INVALID_COMPARE_PRICE"
    );

  const costPriceValue =
    validateOptionalPositiveOrZero(
      "costPrice",
      costPrice,
      "INVALID_COST_PRICE"
    );

  const weightValue =
    validateOptionalPositiveOrZero(
      "weight",
      weight,
      "INVALID_WEIGHT"
    );

  const stockQuantityValue =
    validateOptionalPositiveOrZero(
      "stockQuantity",
      stockQuantity,
      "INVALID_STOCK_QUANTITY"
    );

  const lowStockThresholdValue =
    validateOptionalPositiveOrZero(
      "lowStockThreshold",
      lowStockThreshold,
      "INVALID_LOW_STOCK_THRESHOLD"
    );

  const freshValue =
    parseBoolean(isFresh);

  const stockValue =
    parseBoolean(inStock);

  const featuredValue =
    parseBoolean(isFeatured);

  const activeValue =
    parseBoolean(isActive);

  validateBooleanQuery(
    "isFresh",
    isFresh,
    freshValue,
    "INVALID_FRESH_STATUS"
  );

  validateBooleanQuery(
    "inStock",
    inStock,
    stockValue,
    "INVALID_STOCK_STATUS"
  );

  validateBooleanQuery(
    "isFeatured",
    isFeatured,
    featuredValue,
    "INVALID_FEATURED_STATUS"
  );

  validateBooleanQuery(
    "isActive",
    isActive,
    activeValue,
    "INVALID_ACTIVE_STATUS"
  );

  if (categoryId !== undefined) {
    await validateCategory(categoryId);
  }

  const newSlug =
    normalizedName !== undefined
      ? await createUniqueSlug(
          normalizedName,
          id
        )
      : undefined;

  let finalInStock;

  if (stockQuantity !== undefined) {
    finalInStock =
      stockQuantityValue > 0 &&
      stockValue !== false;
  } else if (inStock !== undefined) {
    finalInStock = stockValue;
  }

  return prisma.product.update({
    where: {
      id,
    },

    data: {
      ...(normalizedName !== undefined
        ? {
            name: normalizedName,
          }
        : {}),

      ...(normalizedNameAr !== undefined
        ? {
            nameAr: normalizedNameAr,
          }
        : {}),

      ...(newSlug !== undefined
        ? {
            slug: newSlug,
          }
        : {}),

      ...(description !== undefined
        ? {
            description:
              normalizeString(
                description
              ),
          }
        : {}),

      ...(descriptionAr !== undefined
        ? {
            descriptionAr:
              normalizeString(
                descriptionAr
              ),
          }
        : {}),

      ...(price !== undefined
        ? {
            price: priceValue,
          }
        : {}),

      ...(comparePrice !== undefined
        ? {
            comparePrice:
              comparePriceValue,
          }
        : {}),

      ...(costPrice !== undefined
        ? {
            costPrice:
              costPriceValue,
          }
        : {}),

      ...(sku !== undefined
        ? {
            sku: normalizeString(sku),
          }
        : {}),

      ...(barcode !== undefined
        ? {
            barcode:
              normalizeString(barcode),
          }
        : {}),

      ...(imageUrl !== undefined
        ? {
            imageUrl:
              normalizeString(imageUrl),
          }
        : {}),

      ...(galleryImages !== undefined
        ? {
            galleryImages:
              normalizeGalleryImages(
                galleryImages
              ),
          }
        : {}),

      ...(isFresh !== undefined
        ? {
            isFresh: freshValue,
          }
        : {}),

      ...(stockQuantity !== undefined
        ? {
            stockQuantity:
              stockQuantityValue,
          }
        : {}),

      ...(finalInStock !== undefined
        ? {
            inStock: finalInStock,
          }
        : {}),

      ...(lowStockThreshold !== undefined
        ? {
            lowStockThreshold:
              lowStockThresholdValue,
          }
        : {}),

      ...(brand !== undefined
        ? {
            brand:
              normalizeString(brand),
          }
        : {}),

      ...(weight !== undefined
        ? {
            weight: weightValue,
          }
        : {}),

      ...(weightUnit !== undefined
        ? {
            weightUnit:
              normalizeString(
                weightUnit
              ),
          }
        : {}),

      ...(unitLabel !== undefined
        ? {
            unitLabel:
              normalizeString(
                unitLabel
              ),
          }
        : {}),

      ...(isFeatured !== undefined
        ? {
            isFeatured:
              featuredValue,
          }
        : {}),

      ...(isActive !== undefined
        ? {
            isActive: activeValue,
          }
        : {}),

      ...(categoryId !== undefined
        ? {
            categoryId,
          }
        : {}),
    },

    select: productSelectForAdmin,
  });
};

const updateProductStatus = async (
  id,
  isActive
) => {
  const activeValue =
    parseBoolean(isActive);

  validateBooleanQuery(
    "isActive",
    isActive,
    activeValue,
    "INVALID_ACTIVE_STATUS"
  );

  await findProductOrFail(id);

  return prisma.product.update({
    where: {
      id,
    },

    data: {
      isActive: activeValue,
    },

    select: productSelectForAdmin,
  });
};

const deleteProduct = async (id) => {
  const product =
    await prisma.product.findUnique({
      where: {
        id,
      },

      include: {
        orderItems: {
          select: {
            id: true,
          },
          take: 1,
        },

        cartItems: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

  if (!product) {
    throw createError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  if (product.orderItems.length > 0) {
    throw createError(
      "Cannot delete product because it exists in orders",
      409,
      "PRODUCT_HAS_ORDERS"
    );
  }

  if (product.cartItems.length > 0) {
    throw createError(
      "Cannot delete product because it exists in carts",
      409,
      "PRODUCT_HAS_CART_ITEMS"
    );
  }

  await prisma.product.delete({
    where: {
      id,
    },
  });

  return {
    message:
      "Product deleted successfully",
  };
};

const getProductsForMobile = async ({
  page = 1,
  limit = DEFAULT_MOBILE_LIMIT,
  search,
  categoryId,
  isFeatured,
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
    typeof search === "string"
      ? search.trim()
      : "";

  const featuredFilter =
    parseBoolean(isFeatured);

  validateBooleanQuery(
    "isFeatured",
    isFeatured,
    featuredFilter,
    "INVALID_FEATURED_STATUS"
  );

  const where = {
    isActive: true,

    ...(categoryId
      ? {
          categoryId,
        }
      : {}),

    ...(featuredFilter !== undefined
      ? {
          isFeatured:
            featuredFilter,
        }
      : {}),

    ...(searchText
      ? {
          OR: [
            {
              name: {
                contains: searchText,
                mode: "insensitive",
              },
            },
            {
              nameAr: {
                contains: searchText,
                mode: "insensitive",
              },
            },
            {
              slug: {
                contains: searchText,
                mode: "insensitive",
              },
            },
            {
              brand: {
                contains: searchText,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const [products, total] =
    await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limitNumber,

        orderBy: [
          {
            isFeatured: "desc",
          },
          {
            createdAt: "desc",
          },
        ],

        select: productSelectForMobile,
      }),

      prisma.product.count({
        where,
      }),
    ]);

  return {
    data: products,

    pagination: {
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(
        total / limitNumber
      ),
    },
  };
};

const getProductByIdForMobile = async (
  id
) => {
  const product =
    await prisma.product.findFirst({
      where: {
        id,
        isActive: true,
      },

      select: productSelectForMobile,
    });

  if (!product) {
    throw createError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  await prisma.product.update({
    where: {
      id,
    },

    data: {
      viewCount: {
        increment: 1,
      },
    },
  });

  return product;
};

module.exports = {
  createProduct,
  getAllProductsForAdmin,
  getProductByIdForAdmin,
  updateProduct,
  updateProductStatus,
  deleteProduct,
  getProductsForMobile,
  getProductByIdForMobile,
};