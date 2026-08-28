const cloudinary = require("../../config/cloudinary");
const env = require("../../config/env");

const uploadProductImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    if (
      !env.cloudinaryCloudName ||
      !env.cloudinaryApiKey ||
      !env.cloudinaryApiSecret
    ) {
      // Fails loudly and specifically instead of silently falling back to
      // local disk (which is what caused the original bug — see
      // architecture.md, 2026-08-28).
      return res.status(500).json({
        success: false,
        message:
          "Image storage isn't configured: missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET",
      });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "almalaki/products",
          resource_type: "image",
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        // Cloudinary's secure_url is already a full https:// URL — the
        // dashboard's resolveImageUrl() passes full URLs through unchanged,
        // so no frontend change is needed for this switch.
        imageUrl: uploadResult.secure_url,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadProductImage,
};
