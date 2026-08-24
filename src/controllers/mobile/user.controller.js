const userService = require("../../services/user.service");

const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profile = await userService.getMyProfile(userId);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

const updateMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profile = await userService.updateMyProfile(userId, req.body);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

const changeMyPassword = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await userService.changeMyPassword(userId, req.body);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

const getMyAddresses = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const addresses = await userService.getMyAddresses(userId);

    res.status(200).json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    next(error);
  }
};

const createMyAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const address = await userService.createMyAddress(userId, req.body);

    res.status(201).json({
      success: true,
      message: "Address created successfully",
      data: address,
    });
  } catch (error) {
    next(error);
  }
};

const updateMyAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.addressId;

    const address = await userService.updateMyAddress(
      userId,
      addressId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: address,
    });
  } catch (error) {
    next(error);
  }
};

const deleteMyAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.addressId;

    const result = await userService.deleteMyAddress(userId, addressId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,

  getMyAddresses,
  createMyAddress,
  updateMyAddress,
  deleteMyAddress,
};