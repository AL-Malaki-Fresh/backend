const multer = require("multer");

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, and WEBP images are allowed"), false);
  }

  cb(null, true);
};

// Files are held in memory only (never written to local disk) and streamed
// straight to Cloudinary by the controller after the content check below
// passes. We stopped using multer's diskStorage on purpose: Render's web
// service disk is ephemeral, so anything saved there was silently lost on
// every redeploy/restart — see the 2026-08-28 note in project memory.
const uploadProductImage = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// ─── Real content validation ────────────────────────────────────────────────
// multer's fileFilter above only sees the client-supplied `mimetype` header,
// which a client can set to anything regardless of the file's actual bytes.
// This checks the magic-byte signature of the in-memory buffer BEFORE it
// ever gets uploaded to Cloudinary. Use as the next middleware after
// `uploadProductImage.single(...)`.
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

  if (!isValidImageContent(req.file.buffer)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_IMAGE_CONTENT",
      message: "Uploaded file is not a valid JPG, PNG, or WEBP image",
    });
  }

  next();
};

module.exports = {
  uploadProductImage,
  validateUploadedImageContent,
};
