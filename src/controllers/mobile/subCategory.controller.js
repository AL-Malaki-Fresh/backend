const subCategoryService = require("../../services/subCategory.service");

const getSubCategoriesForMobile = async (req, res, next) => {
  try {
    const subCategories = await subCategoryService.getSubCategoriesForMobile(
      req.query
    );

    res.status(200).json({
      success: true,
      data: subCategories,
    });
  } catch (error) {
    next(error);
  }
};

const getSubCategoryByIdForMobile = async (req, res, next) => {
  try {
    const subCategory = await subCategoryService.getSubCategoryByIdForMobile(
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

module.exports = {
  getSubCategoriesForMobile,
  getSubCategoryByIdForMobile,
};
