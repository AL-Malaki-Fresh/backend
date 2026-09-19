const promotionService = require("../../services/promotion.service");

const createPromotion = async (req, res, next) => {
  try {
    const data = await promotionService.createPromotion(req.body);

    res.status(201).json({
      success: true,
      message: "Promotion created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const getAllPromotions = async (req, res, next) => {
  try {
    const result = await promotionService.getAllPromotions(req.query);

    res.status(200).json({
      success: true,
      data: result.data,
      statistics: result.statistics,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const getPromotionById = async (req, res, next) => {
  try {
    const data = await promotionService.getPromotionById(req.params.id);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const updatePromotion = async (req, res, next) => {
  try {
    const data = await promotionService.updatePromotion(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Promotion updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const updatePromotionStatus = async (req, res, next) => {
  try {
    const data = await promotionService.updatePromotionStatus(req.params.id, req.body.isActive);

    res.status(200).json({
      success: true,
      message: "Promotion status updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const deletePromotion = async (req, res, next) => {
  try {
    const result = await promotionService.deletePromotion(req.params.id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPromotion,
  getAllPromotions,
  getPromotionById,
  updatePromotion,
  updatePromotionStatus,
  deletePromotion,
};
