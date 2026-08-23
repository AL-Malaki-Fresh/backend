// backend/src/controllers/mobile/cart.controller.js

const cartService = require("../../services/cart.service");

const getMyCart = async (req, res, next) => {
  try {
    const cart = await cartService.getMyCart(req.user.id);

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

const addItemToCart = async (req, res, next) => {
  try {
    const cart = await cartService.addItemToCart(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: "Product added to cart successfully",
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

const updateCartItemQuantity = async (req, res, next) => {
  try {
    const cart = await cartService.updateCartItemQuantity(
      req.user.id,
      req.params.id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Cart item updated successfully",
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

const removeCartItem = async (req, res, next) => {
  try {
    const cart = await cartService.removeCartItem(req.user.id, req.params.id);

    res.status(200).json({
      success: true,
      message: "Cart item removed successfully",
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

const clearMyCart = async (req, res, next) => {
  try {
    const cart = await cartService.clearMyCart(req.user.id);

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearMyCart,
};