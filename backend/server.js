import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/dbConfig.js";
import cors from "cors";
import { setupRoutes } from "./router/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());

app.use(express.json());
connectDB();
setupRoutes(app);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
