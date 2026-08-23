const userService = require("../../services/user.service");

const registerCustomer = async (req, res, next) => {
  try {
    const user = await userService.createUser({
      ...req.body,
      role: "CUSTOMER",
      isVerified: false,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      code: "CUSTOMER_REGISTERED",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const loginCustomer = async (req, res, next) => {
  try {
    const result = await userService.loginUser({
      email: req.body.email,
      password: req.body.password,
      allowedRole: "CUSTOMER",
    });

    res.status(200).json({
      success: true,
      message: "Customer logged in successfully",
      code: "CUSTOMER_LOGIN_SUCCESS",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerCustomer,
  loginCustomer,
};