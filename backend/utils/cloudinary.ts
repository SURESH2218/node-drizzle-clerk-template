import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRETKEY,
});

export const uploadToCloudinary = async (localFilePath: string) => {
  try {
    if (!localFilePath) return null;
    let response;
    try {
      response = await cloudinary.uploader.upload(localFilePath, {
        resource_type: "auto",
      });
    } catch (error) {
      console.log(error);
    }
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath);
    return null;
  }
};
