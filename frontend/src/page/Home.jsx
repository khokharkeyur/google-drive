import React, { useEffect, useState, useRef } from "react";
import { useFormik } from "formik";
import api from "../api/axios";
import { folderSchema, fileSchema } from "../validation/item.schema";
import { toast } from "react-toastify";
import StorageBar from "../component/StorageBar";

const Home = () => {
  const [items, setItems] = useState([]);
  const [usedStorage, setUsedStorage] = useState(0);
  const [parentId, setParentId] = useState("root");
  const [path, setPath] = useState([{ name: "Home", _id: "root" }]);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const fetchItems = async (id = parentId) => {
    try {
      const res = await api.get(`/items/${id}`);
      setItems(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch items");
    }
  };
  const fetchStorage = async () => {
    const res = await api.get("/items/storage");
    setUsedStorage(res.data.used);
  };

  useEffect(() => {
    fetchItems();
    fetchStorage();
  }, [parentId]);

  const handleFolderClick = (item) => {
    setParentId(item._id);

    setPath((prev) => [...prev, { name: item.name, _id: item._id }]);
  };

  const handleBreadcrumbClick = (index) => {
    const folder = path[index];
    setParentId(folder._id);

    setPath(path.slice(0, index + 1));
  };

  const folderFormik = useFormik({
    initialValues: { name: "" },
    validationSchema: folderSchema,
    onSubmit: async (values, { resetForm }) => {
      try {
        await api.post("/items", {
          name: values.name,
          type: "folder",
          parentId: parentId === "root" ? null : parentId,
        });
        toast.success("Folder created!");
        resetForm();
        fetchItems();
        fetchStorage();
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || "Failed to create folder");
      }
    },
  });

  const fileFormik = useFormik({
    initialValues: { file: [] },
    validationSchema: fileSchema,
    onSubmit: async (values, { resetForm }) => {
      if (!values.files.length) {
        toast.error("Please select files");
        return;
      }

      try {
        const formData = new FormData();

        values.files.forEach((file) => {
          formData.append("files", file);
        });

        formData.append("type", "file");
        formData.append("parentId", parentId === "root" ? "" : parentId);

        await api.post("/items", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        toast.success("Files uploaded successfully");

        resetForm();
        if (fileInputRef.current) fileInputRef.current.value = "";

        fetchItems();
        fetchStorage();
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || "Failed to upload file");
      }
    },
  });

  const deleteItem = async (id) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await api.delete(`/items/${id}`);
      toast.success("Item deleted!");
      fetchItems();
      fetchStorage();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete item");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">📁 Drive (10MB Limit)</h1>
        <StorageBar used={usedStorage} />
        <div className="mb-6 text-sm text-gray-600">
          {path.map((folder, index) => (
            <span key={folder._id}>
              <button
                className="hover:underline"
                onClick={() => handleBreadcrumbClick(index)}
              >
                {folder.name}
              </button>
              {index < path.length - 1 && " > "}
            </span>
          ))}
        </div>
        <form onSubmit={folderFormik.handleSubmit} className="flex gap-3 mb-4">
          <input
            type="text"
            name="name"
            placeholder="Folder name"
            className="border p-2 rounded w-full"
            onChange={folderFormik.handleChange}
            value={folderFormik.values.name}
          />
          <button className="bg-blue-600 text-white px-4 rounded">
            Create
          </button>
        </form>
        {folderFormik.errors.name && (
          <p className="text-red-500 text-sm mb-2">
            {folderFormik.errors.name}
          </p>
        )}
        <form onSubmit={fileFormik.handleSubmit} className="flex gap-3 mb-6">
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={(e) =>
              fileFormik.setFieldValue("files", Array.from(e.target.files))
            }
            className="border p-2 rounded w-full"
          />
          <button className="bg-green-600 text-white px-4 rounded">
            Upload
          </button>
        </form>
        {fileFormik.errors.files && (
          <p className="text-red-500 text-sm mt-1">{fileFormik.errors.files}</p>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const files = folderInputRef.current.files;
            if (!files || files.length === 0) {
              toast.error("Please select a folder");
              return;
            }

            const folderName = files[0].webkitRelativePath.split("/")[0];

            const formData = new FormData();
            formData.append("name", folderName);
            formData.append("type", "folder");
            formData.append("parentId", parentId === "root" ? "" : parentId);

            for (let i = 0; i < files.length; i++) {
              formData.append("files", files[i], files[i].webkitRelativePath);
            }

            try {
              await api.post("/items/folder-upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
              });

              toast.success(`Folder "${folderName}" uploaded!`);
              if (folderInputRef.current) folderInputRef.current.value = "";
              fetchItems();
              fetchStorage();
            } catch (err) {
              console.error(err);
              toast.error(
                err.response?.data?.message || "Failed to upload folder"
              );
            }
          }}
          className="flex gap-3 mb-6"
        >
          <input
            type="file"
            ref={folderInputRef}
            webkitdirectory="true"
            directory="true"
            multiple
            className="border p-2 rounded w-full"
          />
          <button className="bg-purple-600 text-white px-4 rounded">
            Upload Folder
          </button>
        </form>
        <div className="grid gap-2">
          {items.map((item) => (
            <div
              key={item._id}
              className="flex justify-between items-center p-3 border rounded hover:bg-gray-50"
            >
              <div
                className="cursor-pointer"
                onClick={() =>
                  item.type === "folder" && handleFolderClick(item)
                }
              >
                {item.type === "folder" ? "📁" : "📄"} {item.name}
              </div>

              <div className="flex gap-3">
                {item.type === "file" && (
                  <a
                    href={`${import.meta.env.VITE_API_BASE_URL}${item.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600"
                  >
                    View
                  </a>
                )}
                <button
                  onClick={() => deleteItem(item._id)}
                  className="text-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
