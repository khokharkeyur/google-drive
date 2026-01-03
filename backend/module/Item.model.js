import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["file", "folder"], required: true },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      default: null,
    },
    url: String,
    size: Number,
    mimeType: String,
    fileHash: {
      type: String,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);
itemSchema.index({ name: 1, parentId: 1, type: 1, fileHash: 1 });

export default mongoose.model("Item", itemSchema);
