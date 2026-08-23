const express = require("express");

const userController = require("../../controllers/mobile/user.controller");


const router = express.Router();



router.get("/me", userController.getMyProfile);
router.put("/me", userController.updateMyProfile);
router.patch("/me/password", userController.changeMyPassword);

router.get("/me/addresses", userController.getMyAddresses);
router.post("/me/addresses", userController.createMyAddress);
router.put("/me/addresses/:addressId", userController.updateMyAddress);
router.delete("/me/addresses/:addressId", userController.deleteMyAddress);

module.exports = router;