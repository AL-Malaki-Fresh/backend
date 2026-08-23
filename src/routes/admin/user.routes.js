const express = require("express");
const userController = require("../../controllers/admin/user.controller");


const router = express.Router();

router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.post("/", userController.createUserByAdmin);
router.put("/:id", userController.updateUser);
router.patch("/:id/status", userController.updateUserStatus);
router.patch("/:id/password", userController.changeUserPassword);
router.delete("/:id", userController.deleteUser);

module.exports = router;