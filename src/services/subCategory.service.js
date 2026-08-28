const prisma = require("../config/prisma");

const createError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const subCategorySelect = {
  id: true,
  categoryId: true,
  name: true,
  nameAr: true,
  slug: true,
  description: true,
  descriptionAr: true,
  icon: true,
  imageUrl: true,
  isActive: true,
  sortOrder: true,
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
  _count: {
    select: {
      products: true,
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

  return slug || `subcategory-${Date.now()}`;
};

const createUniqueSlug = async (name, currentSubCategoryId = null) => {
  const baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existingSubCategory = await prisma.subCategory.findFirst({
      where: {
        slug,
        ...(currentSubCategoryId ? { id: { not: currentSubCategoryId } } : {}),
      },
      select: {
        id: true,
      },
    });

    if (!existingSubCategory) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
};

const validateCategory = async (categoryId) => {
  if (!categoryId) {
    throw createError("Category is required", 400, "CATEGORY_REQUIRED");
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw createError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  return category;
};

const findSubCategoryOrFail = async (id) => {
  const subCategory = await prisma.subCategory.findUnique({
    where: { id },
    select: { id: true, categoryId: true },
  });

  if (!subCategory) {
    throw createError("Subcategory not found", 404, "SUB_CATEGORY_NOT_FOUND");
  }

  return subCategory;
};

const createSubCategory = async ({
  categoryId,
  name,
  nameAr,
  description,
  descriptionAr,
  icon,
  imageUrl,
  isActive = true,
  sortOrder = 0,
}) => {
  const normalizedName = normalizeString(name);

  if (!normalizedName) {
    throw createError(
      "Subcategory name is required",
      400,
      "SUB_CATEGORY_NAME_REQUIRED"
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

  await validateCategory(categoryId);

  const slug = await createUniqueSlug(normalizedName);

  return prisma.subCategory.create({
    data: {
      categoryId,
      name: normalizedName,
      slug,
      nameAr: normalizeString(nameAr),
      description: normalizeString(description),
      descriptionAr: normalizeString(descriptionAr),
      icon: normalizeString(icon),
      imageUrl: normalizeString(imageUrl),
      isActive: activeValue,
      sortOrder: normalizeNumber(sortOrder, 0),
    },
    select: subCategorySelect,
  });
};

const getAllSubCategoriesForAdmin = async ({
  page = 1,
  limit = 10,
  search,
  isActive,
  categoryId,
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
    ...(categoryId ? { categoryId } : {}),
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

  const [subCategories, total] = await Promise.all([
    prisma.subCategory.findMany({
      where,
      skip,
      take: limitNumber,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: subCategorySelect,
    }),
    prisma.subCategory.count({ where }),
  ]);

  return {
    data: subCategories,
    pagination: {
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getSubCategoryByIdForAdmin = async (id) => {
  const subCategory = await prisma.subCategory.findUnique({
    where: { id },
    select: {
      ...subCategorySelect,
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

  if (!subCategory) {
    throw createError("Subcategory not found", 404, "SUB_CATEGORY_NOT_FOUND");
  }

  return subCategory;
};

const updateSubCategory = async (
  id,
  {
    categoryId,
    name,
    nameAr,
    description,
    descriptionAr,
    icon,
    imageUrl,
    isActive,
    sortOrder,
  }
) => {
  await findSubCategoryOrFail(id);

  const normalizedName =
    name !== undefined ? normalizeString(name) : undefined;

  if (name !== undefined && !normalizedName) {
    throw createError(
      "Subcategory name cannot be empty",
      400,
      "SUB_CATEGORY_NAME_REQUIRED"
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

  if (categoryId !== undefined) {
    await validateCategory(categoryId);
  }

  const newSlug =
    normalizedName !== undefined
      ? await createUniqueSlug(normalizedName, id)
      : undefined;

  return prisma.subCategory.update({
    where: { id },
    data: {
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(normalizedName !== undefined ? { name: normalizedName } : {}),
      ...(newSlug !== undefined ? { slug: newSlug } : {}),
      ...(nameAr !== undefined ? { nameAr: normalizeString(nameAr) } : {}),
      ...(description !== undefined
        ? { description: normalizeString(description) }
        : {}),
      ...(descriptionAr !== undefined
        ? { descriptionAr: normalizeString(descriptionAr) }
        : {}),
      ...(icon !== undefined ? { icon: normalizeString(icon) } : {}),
      ...(imageUrl !== undefined ? { imageUrl: normalizeString(imageUrl) } : {}),
      ...(isActive !== undefined ? { isActive: activeValue } : {}),
      ...(sortOrder !== undefined
        ? { sortOrder: normalizeNumber(sortOrder, 0) }
        : {}),
    },
    select: subCategorySelect,
  });
};

const updateSubCategoryStatus = async (id, isActive) => {
  const activeValue = parseBoolean(isActive);

  if (activeValue === undefined) {
    throw createError(
      "isActive must be true or false",
      400,
      "INVALID_ACTIVE_STATUS"
    );
  }

  await findSubCategoryOrFail(id);

  return prisma.subCategory.update({
    where: { id },
    data: {
      isActive: activeValue,
    },
    select: subCategorySelect,
  });
};

const deleteSubCategory = async (id) => {
  const existingSubCategory = await prisma.subCategory.findUnique({
    where: { id },
    include: {
      products: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!existingSubCategory) {
    throw createError("Subcategory not found", 404, "SUB_CATEGORY_NOT_FOUND");
  }

  if (existingSubCategory.products.length > 0) {
    throw createError(
      "Cannot delete subcategory because it has products",
      409,
      "SUB_CATEGORY_HAS_PRODUCTS"
    );
  }

  await prisma.subCategory.delete({
    where: { id },
  });

  return {
    message: "Subcategory deleted successfully",
  };
};

const getSubCategoriesForMobile = async ({ categoryId, search } = {}) => {
  const searchText = typeof search === "string" ? search.trim() : "";

  return prisma.subCategory.findMany({
    where: {
      isActive: true,
      ...(categoryId ? { categoryId } : {}),

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
      categoryId: true,
      name: true,
      nameAr: true,
      slug: true,
      description: true,
      descriptionAr: true,
      icon: true,
      imageUrl: true,
    },
  });
};

const getSubCategoryByIdForMobile = async (id) => {
  const subCategory = await prisma.subCategory.findFirst({
    where: {
      id,
      isActive: true,
    },
    select: {
      id: true,
      categoryId: true,
      name: true,
      nameAr: true,
      slug: true,
      description: true,
      descriptionAr: true,
      icon: true,
      imageUrl: true,
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

  if (!subCategory) {
    throw createError("Subcategory not found", 404, "SUB_CATEGORY_NOT_FOUND");
  }

  return subCategory;
};

module.exports = {
  createSubCategory,
  getAllSubCategoriesForAdmin,
  getSubCategoryByIdForAdmin,
  updateSubCategory,
  updateSubCategoryStatus,
  deleteSubCategory,

  getSubCategoriesForMobile,
  getSubCategoryByIdForMobile,
};
