// src/config/cloudinary.js
//
// Cloudinary is where product/category images actually live now (chosen
// 2026-08-28 to replace local disk storage, which doesn't survive a Render
// redeploy without a paid persistent disk). Free tier is plenty for this
// app's current image volume.

const cloudinary = require("cloudinary").v2;
const env = require("./env");

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
  secure: true,
});

module.exports = cloudinary;
