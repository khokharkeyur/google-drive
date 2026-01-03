import Item from "../module/Item.model.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { calculateUsedStorage } from "../utils/calculateUsedStorage.js";
import { MAX_STORAGE_BYTES } from "../config/storage.js";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const calculateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
};

const getBufferHash = (buffer) => {
  return crypto.createHash("md5").update(buffer).digest("hex");
};

export const createItem = async (req, res) => {
  try {
    const { name, type, parentId } = req.body;

    if (type === "folder") {
      const folder = await Item.create({
        name,
        type: "folder",
        parentId: parentId || null,
      });
      return res.status(201).json(folder);
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Files are required" });
    }

    const used = await calculateUsedStorage();

    const totalUploadSize = req.files.reduce((sum, file) => sum + file.size, 0);

    if (used + totalUploadSize > MAX_STORAGE_BYTES) {
      req.files.forEach((file) => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });

      return res.status(400).json({ message: "Storage limit exceeded" });
    }

    const savedFiles = [];

    for (const file of req.files) {
      const newFile = await Item.create({
        name: file.originalname,
        type: "file",
        parentId: parentId || null,
        url: `/uploads/${file.filename}`,
        size: file.size,
        mimeType: file.mimetype,
      });

      savedFiles.push(newFile);
    }

    res.status(201).json({
      message: "Files uploaded successfully",
      files: savedFiles,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const uploadFolder = async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const currentUsed = await calculateUsedStorage();

    let newFilesSize = 0;
    const processedFiles = [];

    for (const file of files) {
      const fileHash = await calculateFileHash(file.path);

      const exists = await Item.findOne({
        name: path.basename(file.originalname),
        type: "file",
        fileHash,
      });

      if (!exists) {
        newFilesSize += file.size;
        processedFiles.push({ file, fileHash });
      } else {
        fs.unlinkSync(file.path);
      }
    }

    if (currentUsed + newFilesSize > MAX_STORAGE_BYTES) {
      for (const { file } of processedFiles) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }

      return res.status(400).json({
        message: "Insufficient storage for new files",
      });
    }

    let folder = await Item.findOne({
      name,
      type: "folder",
      parentId: parentId || null,
    });

    if (!folder) {
      folder = await Item.create({
        name,
        type: "folder",
        parentId: parentId || null,
      });
    }

    const uploadResults = { uploaded: [], skipped: [] };

    for (const { file, fileHash } of processedFiles) {
      const fileName = path.basename(file.originalname);

      await Item.create({
        name: fileName,
        type: "file",
        url: `/uploads/${file.filename}`,
        size: file.size,
        mimeType: file.mimetype,
        parentId: folder._id,
        fileHash,
      });

      uploadResults.uploaded.push(fileName);
    }

    res.status(201).json({
      message: "Folder upload completed",
      folder,
      uploaded: uploadResults.uploaded.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to upload folder" });
  }
};

export const getItemsByParent = async (req, res) => {
  try {
    const { parentId } = req.params;

    const items = await Item.find({
      parentId: parentId === "root" ? null : parentId,
    }).sort({ type: 1, createdAt: -1 });

    res.json(items);
  } catch (error) {
    console.error("GET ITEMS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getStorage = async (req, res) => {
  try {
    const used = await calculateUsedStorage();
    res.json({ used, max: MAX_STORAGE_BYTES });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch storage" });
  }
};

export const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    await deleteRecursive(item);

    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteRecursive = async (item) => {
  if (item.type === "folder") {
    const children = await Item.find({ parentId: item._id });

    for (const child of children) {
      await deleteRecursive(child);
    }
  }

  if (item.type === "file" && item.url) {
    const filePath = path.join(
      __dirname,
      "..",
      item.url.replace("/uploads/", "uploads/")
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  await Item.deleteOne({ _id: item._id });
};
