import Item from "../module/Item.model.js";

export const calculateUsedStorage = async () => {
  const files = await Item.find({ type: "file" });
  const usedBytes = files.reduce((total, file) => total + file.size, 0);
  return usedBytes;
};
