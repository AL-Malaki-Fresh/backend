const userService = require("../../services/user.service");

const getAllUsers = async (req, res, next) => {
  try {
    const result = await userService.getAllUsers(req.query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const createUserByAdmin = async (req, res, next) => {
  try {
    const role = req.body.role || "CUSTOMER";

    const user = await userService.createUser({
      ...req.body,
      role,
      isVerified: true,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      code: "USER_CREATED",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      code: "USER_UPDATED",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const user = await userService.updateUserStatus(
      req.params.id,
      req.body.isActive
    );

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      code: "USER_STATUS_UPDATED",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const changeUserPassword = async (req, res, next) => {
  try {
    const user = await userService.changeUserPassword(
      req.params.id,
      req.body.newPassword
    );

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
      code: "PASSWORD_CHANGED",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const result = await userService.deleteUser(req.params.id);

    res.status(200).json({
      success: true,
      message: result.message,
      code: "USER_DELETED",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUserByAdmin,
  updateUser,
  updateUserStatus,
  changeUserPassword,
  deleteUser,
};