import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import itemRoutes from "./item.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const setupRoutes = (app) => {
  app.use("/items", itemRoutes);
  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
};
