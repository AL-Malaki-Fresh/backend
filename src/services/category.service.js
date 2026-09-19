const prisma = require("../config/prisma");

const createError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  nameAr: true,
  description: true,
  descriptionAr: true,
  imageUrl: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      products: true,
      subCategories: true,
    },
  },
};

const normalizeString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmedValue = String(value).trim();
  return trimmedValue || null;
};

const normalizeNumber = (value, defaultValue = undefined) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return defaultValue;
  }

  return numberValue;
};

const parseBoolean = (value) => {
  if (value === undefined) return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

const generateSlug = (text) => {
  const slug = String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `category-${Date.now()}`;
};

const createUniqueSlug = async (name, currentCategoryId = null) => {
  const baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existingCategory = await prisma.category.findFirst({
      where: {
        slug,
        ...(currentCategoryId ? { id: { not: currentCategoryId } } : {}),
      },
      select: {
        id: true,
      },
    });

    if (!existingCategory) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
};

const createCategory = async ({
  name,
  nameAr,
  description,
  descriptionAr,
  imageUrl,
  isActive = true,
  sortOrder = 0,
}) => {
  const normalizedName = normalizeString(name);

  if (!normalizedName) {
    throw createError(
      "Category name is required",
      400,
      "CATEGORY_NAME_REQUIRED"
    );
  }

  const activeValue = parseBoolean(isActive);

  if (activeValue === undefined) {
    throw createError(
      "isActive must be true or false",
      400,
      "INVALID_ACTIVE_STATUS"
    );
  }

  const slug = await createUniqueSlug(normalizedName);

  return prisma.category.create({
    data: {
      name: normalizedName,
      slug,
      nameAr: normalizeString(nameAr),
      description: normalizeString(description),
      descriptionAr: normalizeString(descriptionAr),
      imageUrl: normalizeString(imageUrl),
      isActive: activeValue,
      sortOrder: normalizeNumber(sortOrder, 0),
    },
    select: categorySelect,
  });
};

// Store-wide category counters for the admin list header cards (not
// affected by the list's search/filters/page).
const getCategoryStatistics = async () => {
  const [total, active, inactive, totalSubCategories, totalProducts] =
    await Promise.all([
      prisma.category.count(),
      prisma.category.count({ where: { isActive: true } }),
      prisma.category.count({ where: { isActive: false } }),
      prisma.subCategory.count(),
      prisma.product.count(),
    ]);

  return { total, active, inactive, totalSubCategories, totalProducts };
};

const getAllCategoriesForAdmin = async ({
  page = 1,
  limit = 10,
  search,
  isActive,
} = {}) => {
  const rawPage = Number(page);
  const rawLimit = Number(limit);

  const pageNumber =
    Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const limitNumber =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 100)
      : 10;

  const skip = (pageNumber - 1) * limitNumber;

  const activeFilter = parseBoolean(isActive);
  const searchText = typeof search === "string" ? search.trim() : "";

  if (isActive !== undefined && activeFilter === undefined) {
    throw createError(
      "isActive must be true or false",
      400,
      "INVALID_ACTIVE_STATUS"
    );
  }

  const where = {
    ...(activeFilter !== undefined ? { isActive: activeFilter } : {}),

    ...(searchText
      ? {
          OR: [
            { name: { contains: searchText, mode: "insensitive" } },
            { slug: { contains: searchText, mode: "insensitive" } },
            { nameAr: { contains: searchText, mode: "insensitive" } },
            { description: { contains: searchText, mode: "insensitive" } },
            { descriptionAr: { contains: searchText, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [categories, total, statistics] = await Promise.all([
    prisma.category.findMany({
      where,
      skip,
      take: limitNumber,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: categorySelect,
    }),
    prisma.category.count({ where }),
    getCategoryStatistics(),
  ]);

  return {
    data: categories,
    statistics,
    pagination: {
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getCategoryByIdForAdmin = async (id) => {
  const category = await prisma.category.findUnique({
    where: { id },
    select: {
      ...categorySelect,
      subCategories: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          nameAr: true,
          slug: true,
          imageUrl: true,
          isActive: true,
          sortOrder: true,
        },
      },
      products: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          price: true,
          imageUrl: true,
          isActive: true,
          stockQuantity: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!category) {
    throw createError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  return category;
};

const updateCategory = async (
  id,
  {
    name,
    nameAr,
    description,
    descriptionAr,
    imageUrl,
    isActive,
    sortOrder,
  }
) => {
  const existingCategory = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
    },
  });

  if (!existingCategory) {
    throw createError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  const normalizedName =
    name !== undefined ? normalizeString(name) : undefined;

  if (name !== undefined && !normalizedName) {
    throw createError(
      "Category name cannot be empty",
      400,
      "CATEGORY_NAME_REQUIRED"
    );
  }

  const activeValue = parseBoolean(isActive);

  if (isActive !== undefined && activeValue === undefined) {
    throw createError(
      "isActive must be true or false",
      400,
      "INVALID_ACTIVE_STATUS"
    );
  }

  const newSlug =
    normalizedName !== undefined
      ? await createUniqueSlug(normalizedName, id)
      : undefined;

  return prisma.category.update({
    where: { id },
    data: {
      ...(normalizedName !== undefined ? { name: normalizedName } : {}),
      ...(newSlug !== undefined ? { slug: newSlug } : {}),
      ...(nameAr !== undefined ? { nameAr: normalizeString(nameAr) } : {}),
      ...(description !== undefined
        ? { description: normalizeString(description) }
        : {}),
      ...(descriptionAr !== undefined
        ? { descriptionAr: normalizeString(descriptionAr) }
        : {}),
      ...(imageUrl !== undefined ? { imageUrl: normalizeString(imageUrl) } : {}),
      ...(isActive !== undefined ? { isActive: activeValue } : {}),
      ...(sortOrder !== undefined
        ? { sortOrder: normalizeNumber(sortOrder, 0) }
        : {}),
    },
    select: categorySelect,
  });
};

const updateCategoryStatus = async (id, isActive) => {
  const activeValue = parseBoolean(isActive);

  if (activeValue === undefined) {
    throw createError(
      "isActive must be true or false",
      400,
      "INVALID_ACTIVE_STATUS"
    );
  }

  const existingCategory = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
    },
  });

  if (!existingCategory) {
    throw createError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  return prisma.category.update({
    where: { id },
    data: {
      isActive: activeValue,
    },
    select: categorySelect,
  });
};

const deleteCategory = async (id) => {
  const existingCategory = await prisma.category.findUnique({
    where: { id },
    include: {
      products: {
        select: { id: true },
        take: 1,
      },
      subCategories: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!existingCategory) {
    throw createError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  if (existingCategory.products.length > 0) {
    throw createError(
      "Cannot delete category because it has products",
      409,
      "CATEGORY_HAS_PRODUCTS"
    );
  }

  if (existingCategory.subCategories.length > 0) {
    throw createError(
      "Cannot delete category because it has subcategories",
      409,
      "CATEGORY_HAS_CHILDREN"
    );
  }

  await prisma.category.delete({
    where: { id },
  });

  return {
    message: "Category deleted successfully",
  };
};

const getCategoriesForMobile = async ({ search } = {}) => {
  const searchText = typeof search === "string" ? search.trim() : "";

  return prisma.category.findMany({
    where: {
      isActive: true,

      ...(searchText
        ? {
            OR: [
              { name: { contains: searchText, mode: "insensitive" } },
              { slug: { contains: searchText, mode: "insensitive" } },
              { nameAr: { contains: searchText, mode: "insensitive" } },
              { description: { contains: searchText, mode: "insensitive" } },
              { descriptionAr: { contains: searchText, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      nameAr: true,
      description: true,
      descriptionAr: true,
      imageUrl: true,
      icon: true,
      subCategories: {
        where: {
          isActive: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          nameAr: true,
          imageUrl: true,
          icon: true,
          categoryId: true,
        },
      },
    },
  });
};

const getCategoryByIdForMobile = async (id) => {
  const category = await prisma.category.findFirst({
    where: {
      id,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      nameAr: true,
      description: true,
      descriptionAr: true,
      imageUrl: true,
      icon: true,
      subCategories: {
        where: {
          isActive: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          nameAr: true,
          imageUrl: true,
          icon: true,
          categoryId: true,
        },
      },
      products: {
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          name: true,
          nameAr: true,
          price: true,
          comparePrice: true,
          imageUrl: true,
          unitLabel: true,
          stockQuantity: true,
        },
      },
    },
  });

  if (!category) {
    throw createError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  return category;
};

module.exports = {
  createCategory,
  getAllCategoriesForAdmin,
  getCategoryByIdForAdmin,
  updateCategory,
  updateCategoryStatus,
  deleteCategory,

  getCategoriesForMobile,
  getCategoryByIdForMobile,
};