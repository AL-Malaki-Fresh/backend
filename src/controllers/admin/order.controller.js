const orderService = require("../../services/order.service");

const getAllOrders = async (req, res, next) => {
  try {
    const result =
      await orderService.getAllOrdersForAdmin(
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

const getOrderById = async (
  req,
  res,
  next
) => {
  try {
    const order =
      await orderService.getOrderByIdForAdmin(
        req.params.id
      );

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (
  req,
  res,
  next
) => {
  try {
    const order =
      await orderService.updateOrderStatus(
        req.params.id,
        {
          status: req.body.status,
          notes: req.body.notes,
        },
        req.user
      );

    res.status(200).json({
      success: true,
      message:
        "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

const updatePaymentStatus = async (
  req,
  res,
  next
) => {
  try {
    const order =
      await orderService.updatePaymentStatus(
        req.params.id,
        req.body.paymentStatus,
        req.user
      );

    res.status(200).json({
      success: true,
      message:
        "Payment status updated successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
};