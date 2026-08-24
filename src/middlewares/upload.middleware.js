const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../../uploads/products");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, and WEBP images are allowed"), false);
  }

  cb(null, true);
};

const uploadProductImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// ─── Real content validation ────────────────────────────────────────────────
// multer's fileFilter above only sees the client-supplied `mimetype` header,
// which a client can set to anything regardless of the file's actual bytes.
// This checks the magic-byte signature of the file multer already saved to
// disk, and deletes it if the content doesn't actually match an allowed
// image type. Use as the next middleware after `uploadProductImage.single(...)`.
const matchesSignature = (buffer, signature) =>
  signature.every((byte, i) => buffer[i] === byte);

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const isValidImageContent = (buffer) => {
  if (matchesSignature(buffer, JPEG_SIGNATURE)) return true;
  if (matchesSignature(buffer, PNG_SIGNATURE)) return true;
  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return true;
  }
  return false;
};

const validateUploadedImageContent = (req, res, next) => {
  if (!req.file) return next();

  fs.open(req.file.path, "r", (openErr, fd) => {
    if (openErr) return next(openErr);

    const header = Buffer.alloc(12);
    fs.read(fd, header, 0, 12, 0, (readErr) => {
      fs.close(fd, () => {});

      if (readErr) return next(readErr);

      if (!isValidImageContent(header)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({
          success: false,
          code: "INVALID_IMAGE_CONTENT",
          message: "Uploaded file is not a valid JPG, PNG, or WEBP image",
        });
      }

      next();
    });
  });
};

module.exports = {
  uploadProductImage,
  validateUploadedImageContent,
};
