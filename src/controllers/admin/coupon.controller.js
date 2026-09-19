const couponService = require("../../services/coupon.service");

const createCoupon = async (req, res, next) => {
  try {
    const data = await couponService.createCoupon(req.body);

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const getAllCoupons = async (req, res, next) => {
  try {
    const result = await couponService.getAllCoupons(req.query);

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

const getCouponById = async (req, res, next) => {
  try {
    const data = await couponService.getCouponById(req.params.id);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const updateCoupon = async (req, res, next) => {
  try {
    const data = await couponService.updateCoupon(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const updateCouponStatus = async (req, res, next) => {
  try {
    const data = await couponService.updateCouponStatus(req.params.id, req.body.isActive);

    res.status(200).json({
      success: true,
      message: "Coupon status updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const deleteCoupon = async (req, res, next) => {
  try {
    const result = await couponService.deleteCoupon(req.params.id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  updateCouponStatus,
  deleteCoupon,
};
