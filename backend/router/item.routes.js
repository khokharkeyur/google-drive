import express from "express";
import upload from "../middlewares/upload.middleware.js";
import {
  createItem,
  deleteItem,
  getItemsByParent,
  getStorage,
  uploadFolder,
} from "../controller/item.controller.js";

const router = express.Router();

router.post("/", upload.single("file"), createItem);
router.post("/folder-upload", upload.array("files"), uploadFolder);

router.get("/storage", getStorage);
router.get("/:parentId", getItemsByParent);

router.delete("/:id", deleteItem);

export default router;
