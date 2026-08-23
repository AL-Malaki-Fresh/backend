const uploadProductImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    const imageUrl = `/uploads/products/${req.file.filename}`;

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        imageUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadProductImage,
};