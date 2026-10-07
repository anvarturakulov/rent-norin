import {
  Body,
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Get,
  Param,
  Res,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { Response } from "express";
import * as fs from "fs";

// Конфигурация для сохранения файлов товаров
const storage = diskStorage({
  destination: "./uploads/images/products", // Папка для изображений товаров
  filename: (req, file, callback) => {
    // Генерируем уникальное имя файла
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    const filename = `product-${uniqueSuffix}${ext}`;
    callback(null, filename);
  },
});

// Конфигурация для сохранения файлов накладных документов
const docsStorage = diskStorage({
  destination: "./uploads/docs", // Папка для изображений накладных
  filename: (req, file, callback) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    const filename = `doc-${uniqueSuffix}${ext}`;
    callback(null, filename);
  },
});

// Конфигурация для файлов мебельных заявок
const furnitureOrderStorage = diskStorage({
  destination: (req, file, callback) => {
    const dir = "./uploads/furniture-orders";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    callback(null, dir);
  },
  filename: (req, file, callback) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    const filename = `fo-${uniqueSuffix}${ext}`;
    callback(null, filename);
  },
});

const tmzProductStorage = diskStorage({
  destination: (req, file, callback) => {
    const dir = "./uploads/tmz-products";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    callback(null, dir);
  },
  filename: (req, file, callback) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    const filename = `tmz-${uniqueSuffix}${ext}`;
    callback(null, filename);
  },
});

// Фильтр для проверки типа файла (общий для всех изображений)
const imageFileFilter = (req: any, file: any, callback: any) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new BadRequestException(
        "Только изображения разрешены (JPEG, PNG, GIF, WebP)",
      ),
      false,
    );
  }
};

const furnitureFileFilter = (req: any, file: any, callback: any) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new BadRequestException("Недопустимый тип файла для заявки"),
      false,
    );
  }
};

/** ТМЗ SCALING/DRAWING: только расм, PDF, Excel (согласовано с accept на фронте). */
const tmzProductFileFilter = (req: any, file: any, callback: any) => {
  const allowedMime = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/svg+xml",
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  const ext = extname(file.originalname || "").toLowerCase();
  const allowedExt = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".svg",
    ".pdf",
    ".xls",
    ".xlsx",
  ];
  if (
    allowedMime.includes(file.mimetype) ||
    allowedExt.includes(ext) ||
    (file.mimetype === "application/octet-stream" && allowedExt.includes(ext))
  ) {
    callback(null, true);
  } else {
    callback(
      new BadRequestException(
        "ТМЗ учун фақат расм (JPEG, PNG, …), PDF ёки Excel (.xls, .xlsx) рухсат",
      ),
      false,
    );
  }
};

@Controller("upload")
export class UploadController {
  @Post("product-image")
  @UseInterceptors(
    FileInterceptor("image", {
      storage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // Максимум 5MB
      },
    }),
  )
  async uploadProductImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Файл не загружен");
    }

    // Возвращаем информацию о загруженном файле
    return {
      success: true,
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      imagePath: file.filename, // Это поле будет сохранено в БД
      url: `/api/upload/image/${file.filename}`, // URL для доступа к изображению
    };
  }

  @Post("doc-invoice-image")
  @UseInterceptors(
    FileInterceptor("image", {
      storage: docsStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // Максимум 5MB для изображений накладных
      },
    }),
  )
  async uploadDocInvoiceImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Файл не загружен");
    }

    return {
      success: true,
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      imagePath: file.filename,
      url: `/api/upload/doc-image/${file.filename}`,
    };
  }

  @Post("furniture-order-file")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: furnitureOrderStorage,
      fileFilter: furnitureFileFilter,
      limits: {
        fileSize: 20 * 1024 * 1024, // 20MB
      },
    }),
  )
  async uploadFurnitureOrderFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Файл не загружен");
    }

    return {
      success: true,
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: `/api/upload/furniture-order-file/${file.filename}`,
    };
  }

  @Post("tmz-product-file")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: tmzProductStorage,
      fileFilter: tmzProductFileFilter,
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  async uploadTmzProductFile(
    @UploadedFile() file: Express.Multer.File,
    @Body("referenceId") referenceId?: string,
    @Body("kind") kind?: "SCALING" | "DRAWING",
  ) {
    if (!file) {
      throw new BadRequestException("Файл не загружен");
    }
    if (kind && kind !== "SCALING" && kind !== "DRAWING") {
      throw new BadRequestException("kind должен быть SCALING или DRAWING");
    }

    return {
      success: true,
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: `/api/upload/tmz-product-file/${file.filename}`,
      referenceId: referenceId ? Number(referenceId) : undefined,
      kind,
    };
  }

  @Get("image/:filename")
  async getImage(@Param("filename") filename: string, @Res() res: Response) {
    try {
      if (
        filename.includes("..") ||
        filename.includes("/") ||
        filename.includes("\\")
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Некорректное имя файла" });
      }

      const imagePath = join(
        process.cwd(),
        "uploads/images/products",
        filename,
      );

      // Проверяем, существует ли файл
      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({
          success: false,
          message: "Изображение не найдено",
        });
      }

      // Определяем MIME тип по расширению
      const ext = extname(filename).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
      };

      const mimeType = mimeTypes[ext] || "application/octet-stream";

      // Устанавливаем заголовки
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Кэшируем на год

      // Отправляем файл
      res.sendFile(imagePath);
    } catch (error) {
      console.error("Ошибка при получении изображения:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка сервера при получении изображения",
      });
    }
  }

  @Get("doc-image/:filename")
  async getDocImage(@Param("filename") filename: string, @Res() res: Response) {
    try {
      // Простая защита от path traversal: запрещаем разделители директорий
      if (
        filename.includes("..") ||
        filename.includes("/") ||
        filename.includes("\\")
      ) {
        return res.status(400).json({
          success: false,
          message: "Некорректное имя файла",
        });
      }

      const imagePath = join(process.cwd(), "uploads/docs", filename);

      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({
          success: false,
          message: "Изображение не найдено",
        });
      }

      const ext = extname(filename).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
      };

      const mimeType = mimeTypes[ext] || "application/octet-stream";

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000");

      res.sendFile(imagePath);
    } catch (error) {
      console.error("Ошибка при получении изображения накладной:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка сервера при получении изображения накладной",
      });
    }
  }

  @Get("furniture-order-file/:filename")
  async getFurnitureOrderFile(
    @Param("filename") filename: string,
    @Res() res: Response,
  ) {
    try {
      if (
        filename.includes("..") ||
        filename.includes("/") ||
        filename.includes("\\")
      ) {
        return res.status(400).json({
          success: false,
          message: "Некорректное имя файла",
        });
      }

      const filePath = join(
        process.cwd(),
        "uploads/furniture-orders",
        filename,
      );

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: "Файл не найден",
        });
      }

      const ext = extname(filename).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".txt": "text/plain",
      };

      const mimeType = mimeTypes[ext] || "application/octet-stream";
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.sendFile(filePath);
    } catch (error) {
      console.error("Ошибка при получении файла заявки:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка сервера при получении файла заявки",
      });
    }
  }

  @Get("tmz-product-file/:filename")
  async getTmzProductFile(
    @Param("filename") filename: string,
    @Res() res: Response,
  ) {
    try {
      if (
        filename.includes("..") ||
        filename.includes("/") ||
        filename.includes("\\")
      ) {
        return res.status(400).json({
          success: false,
          message: "Некорректное имя файла",
        });
      }

      const filePath = join(process.cwd(), "uploads/tmz-products", filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: "Файл не найден",
        });
      }

      const ext = extname(filename).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".svg": "image/svg+xml",
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".txt": "text/plain",
      };

      const mimeType = mimeTypes[ext] || "application/octet-stream";
      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      );
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.sendFile(filePath);
    } catch (error) {
      console.error("Ошибка при получении файла ТМЗ:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка сервера при получении файла ТМЗ",
      });
    }
  }

  @Get("images/list")
  async getImagesList() {
    try {
      const imagesDir = join(process.cwd(), "uploads/images/products");

      // Создаем папку если её нет
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
        return { images: [] };
      }

      const files = fs.readdirSync(imagesDir);
      const images = files
        .filter((file) => {
          const ext = extname(file).toLowerCase();
          return [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);
        })
        .map((file) => {
          const stats = fs.statSync(join(imagesDir, file));
          return {
            filename: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            url: `/api/upload/image/${file}`,
          };
        })
        .sort((a, b) => b.modified.getTime() - a.modified.getTime()); // Сортируем по дате изменения

      return { images };
    } catch (error) {
      console.error("Ошибка при получении списка изображений:", error);
      return {
        success: false,
        message: "Ошибка при получении списка изображений",
        images: [],
      };
    }
  }
}
