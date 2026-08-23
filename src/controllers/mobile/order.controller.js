const orderService = require("../../services/order.service");

const checkout = async (req, res, next) => {
  try {
    const order = await orderService.createOrderFromCart(req.user, req.body);

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const result = await orderService.getMyOrders(req.user.id, req.query);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const getMyOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getMyOrderById(req.user.id, req.params.id);

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkout,
  getMyOrders,
  getMyOrderById,
};