import * as Yup from "yup";

export const folderSchema = Yup.object({
  name: Yup.string().required("Folder name is required"),
});

export const fileSchema = Yup.object({
  files: Yup.array()
    .min(1, "At least one file is required")
    .required("Files are required"),
});
