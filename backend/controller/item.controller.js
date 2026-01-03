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

    if (!req.file) {
      return res.status(400).json({ message: "File required" });
    }

    const used = await calculateUsedStorage();

    if (used + req.file.size > MAX_STORAGE_BYTES) {
      fs.unlinkSync(req.file.path);
      return res
        .status(400)
        .json({ message: "Storage limit exceeded (500 MB)" });
    }

    const file = await Item.create({
      name: req.file.originalname,
      type: "file",
      parentId: parentId || null,
      url: `/uploads/${req.file.filename}`,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });

    res.status(201).json(file);
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

    const currentUsed = await calculateUsedStorage();

    const uploadResults = {
      uploaded: [],
      skipped: [],
      failed: [],
    };

    let newFilesSize = 0;
    const filesToUpload = [];

    for (const file of files) {
      const relativePath = file.originalname;
      const fileName = path.basename(relativePath);
      const fileHash = await calculateFileHash(file.path);

      const existingFile = await Item.findOne({
        name: fileName,
        type: "file",
        parentId: folder._id,
        size: file.size,
        fileHash: fileHash,
      });

      if (existingFile) {
        fs.unlinkSync(file.path);
        uploadResults.skipped.push({
          name: fileName,
          size: file.size,
          reason: "Already exists",
        });
      } else {
        newFilesSize += file.size;
        filesToUpload.push({
          file,
          fileName,
          fileHash,
        });
      }
    }

    if (currentUsed + newFilesSize > MAX_STORAGE_BYTES) {
      for (const { file } of filesToUpload) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }

      const availableSpace = MAX_STORAGE_BYTES - currentUsed;
      return res.status(400).json({
        message: "Insufficient storage for new files",
        details: {
          currentUsed: `${(currentUsed / (1024 * 1024)).toFixed(2)} MB`,
          availableSpace: `${(availableSpace / (1024 * 1024)).toFixed(2)} MB`,
          requiredSpace: `${(newFilesSize / (1024 * 1024)).toFixed(2)} MB`,
          skippedFiles: uploadResults.skipped.length,
        },
      });
    }

    for (const { file, fileName, fileHash } of filesToUpload) {
      try {
        const newFile = await Item.create({
          name: fileName,
          type: "file",
          url: `/uploads/${file.filename}`,
          size: file.size,
          mimeType: file.mimetype,
          parentId: folder._id,
          fileHash: fileHash,
        });

        uploadResults.uploaded.push({
          name: fileName,
          size: file.size,
        });
      } catch (err) {
        console.error(`Failed to save file ${fileName}:`, err);
        uploadResults.failed.push({
          name: fileName,
          error: err.message,
        });
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    res.status(201).json({
      message: "Folder upload completed",
      folder: {
        name: folder.name,
        _id: folder._id,
      },
      results: {
        uploaded: uploadResults.uploaded.length,
        skipped: uploadResults.skipped.length,
        failed: uploadResults.failed.length,
        details: uploadResults,
      },
    });
  } catch (err) {
    console.error(err);

    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr);
          }
        }
      }
    }

    res
      .status(500)
      .json({ message: "Failed to upload folder", error: err.message });
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
