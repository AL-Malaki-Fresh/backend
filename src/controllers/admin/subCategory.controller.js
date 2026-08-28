const subCategoryService = require("../../services/subCategory.service");

const createSubCategory = async (req, res, next) => {
  try {
    const subCategory = await subCategoryService.createSubCategory(req.body);

    res.status(201).json({
      success: true,
      message: "Subcategory created successfully",
      data: subCategory,
    });
  } catch (error) {
    next(error);
  }
};

const getAllSubCategories = async (req, res, next) => {
  try {
    const result = await subCategoryService.getAllSubCategoriesForAdmin(
      req.query
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const getSubCategoryById = async (req, res, next) => {
  try {
    const subCategory = await subCategoryService.getSubCategoryByIdForAdmin(
      req.params.id
    );

    res.status(200).json({
      success: true,
      data: subCategory,
    });
  } catch (error) {
    next(error);
  }
};

const updateSubCategory = async (req, res, next) => {
  try {
    const subCategory = await subCategoryService.updateSubCategory(
      req.params.id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Subcategory updated successfully",
      data: subCategory,
    });
  } catch (error) {
    next(error);
  }
};

const updateSubCategoryStatus = async (req, res, next) => {
  try {
    const subCategory = await subCategoryService.updateSubCategoryStatus(
      req.params.id,
      req.body.isActive
    );

    res.status(200).json({
      success: true,
      message: "Subcategory status updated successfully",
      data: subCategory,
    });
  } catch (error) {
    next(error);
  }
};

const deleteSubCategory = async (req, res, next) => {
  try {
    const result = await subCategoryService.deleteSubCategory(req.params.id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSubCategory,
  getAllSubCategories,
  getSubCategoryById,
  updateSubCategory,
  updateSubCategoryStatus,
  deleteSubCategory,
};
