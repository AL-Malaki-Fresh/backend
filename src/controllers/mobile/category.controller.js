const categoryService = require("../../services/category.service");

const getCategoriesForMobile = async (req, res, next) => {
  try {
    const categories = await categoryService.getCategoriesForMobile(req.query);

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

const getCategoryByIdForMobile = async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryByIdForMobile(req.params.id);

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategoriesForMobile,
  getCategoryByIdForMobile,
};