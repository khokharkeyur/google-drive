import * as Yup from "yup";

export const folderSchema = Yup.object({
  name: Yup.string().required("Folder name is required"),
});

export const fileSchema = Yup.object({
  file: Yup.mixed().required("File is required"),
});
