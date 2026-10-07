import { Injectable } from "@nestjs/common";
import { DocumentType } from "src/interfaces/document.interface";
import { TypeReference } from "src/interfaces/reference.interface";
import { ReportType } from "src/interfaces/report.interface";
import * as fs from "fs";
import * as path from "path";

export enum RegistryItemType {
  DOCUMENT = "document",
  REFERENCE = "reference",
  REPORT = "report",
  INFORM_REPORT = "informReport",
  SERVICE = "servis",
  GATE = "gate",
  FURNITURE = "furniture",
}

export interface RegistryItem {
  type: RegistryItemType;
  value: string;
  key: string; // Ключ для связи с MenuData (например, DocumentType.ComeMaterial)
}

export interface AvailableItems {
  documents: RegistryItem[];
  references: RegistryItem[];
  reports: RegistryItem[];
  informReports: RegistryItem[];
  services: RegistryItem[];
  gates: RegistryItem[];
  furniture: RegistryItem[];
}

@Injectable()
export class RegistryService {
  private cache: AvailableItems | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 минут

  /**
   * Получить все доступные элементы из всех категорий
   */
  getAllAvailableItems(): AvailableItems {
    const now = Date.now();

    // Проверяем кэш
    if (this.cache && now - this.cacheTimestamp < this.CACHE_TTL) {
      return this.cache;
    }

    const items: AvailableItems = {
      documents: this.getAvailableDocuments(),
      references: this.getAvailableReferences(),
      reports: this.getAvailableReports(),
      informReports: this.getAvailableInformReports(),
      services: this.getAvailableServices(),
      gates: this.getAvailableGates(),
      furniture: this.getAvailableFurniture(),
    };

    // Обновляем кэш
    this.cache = items;
    this.cacheTimestamp = now;

    return items;
  }

  /**
   * Получить доступные документы из enum DocumentType
   */
  getAvailableDocuments(): RegistryItem[] {
    const documents: RegistryItem[] = [];

    // Исключаем Error из списка доступных документов
    Object.values(DocumentType)
      .filter((type) => type !== DocumentType.Error)
      .forEach((type) => {
        documents.push({
          type: RegistryItemType.DOCUMENT,
          value: type,
          key: `DocumentType.${type}`,
        });
      });

    return documents;
  }

  /**
   * Получить доступные справочники из enum TypeReference
   */
  getAvailableReferences(): RegistryItem[] {
    const references: RegistryItem[] = [];

    Object.values(TypeReference).forEach((type) => {
      references.push({
        type: RegistryItemType.REFERENCE,
        value: type,
        key: `TypeReference.${type}`,
      });
    });

    return references;
  }

  /**
   * Получить доступные отчеты из enum ReportType
   */
  getAvailableReports(): RegistryItem[] {
    const reports: RegistryItem[] = [];

    Object.values(ReportType).forEach((type) => {
      reports.push({
        type: RegistryItemType.REPORT,
        value: type,
        key: `ReportType.${type}`,
      });
    });

    return reports;
  }

  /**
   * Получить доступные inform отчеты, парся файл information.ts
   */
  getAvailableInformReports(): RegistryItem[] {
    const informReports: RegistryItem[] = [];

    try {
      // Путь к файлу information.ts относительно корня проекта
      const informationFilePath = path.join(
        __dirname,
        "..",
        "..",
        "reports",
        "components",
        "information",
        "information.ts",
      );

      if (!fs.existsSync(informationFilePath)) {
        console.warn(`File not found: ${informationFilePath}`);
        return informReports;
      }

      const fileContent = fs.readFileSync(informationFilePath, "utf-8");

      // Парсим все условия reportType == 'X' или reportType == 'All'
      const reportTypePattern = /reportType\s*==\s*['"]([^'"]+)['"]/g;
      const foundReports = new Set<string>();

      let match;
      while ((match = reportTypePattern.exec(fileContent)) !== null) {
        const reportType = match[1];
        if (reportType !== "All") {
          foundReports.add(reportType);
        }
      }

      // Преобразуем найденные отчеты в RegistryItem
      foundReports.forEach((reportType) => {
        // Проверяем, есть ли этот отчет в enum ReportType
        const isInEnum = Object.values(ReportType).includes(
          reportType as ReportType,
        );

        informReports.push({
          type: RegistryItemType.INFORM_REPORT,
          value: reportType,
          key: isInEnum
            ? `ReportType.${reportType}`
            : `InformReport.${reportType}`,
        });
      });
    } catch (error) {
      console.error("Error parsing inform reports:", error);
    }

    return informReports;
  }

  /**
   * Получить доступные сервисы
   * ServiceType определен на frontend, поэтому используем известные значения
   */
  getAvailableServices(): RegistryItem[] {
    // ServiceType определен на frontend, используем известные значения
    // Значения соответствуют ключам enum из frontend
    const serviceTypes = [
      { value: "DeleteDocs", key: "DeleteDocs" },
      { value: "Users", key: "Users" },
      { value: "Enterprises", key: "Enterprises" },
      { value: "Options", key: "Options" },
      { value: "PricingPolicy", key: "PricingPolicy" },
    ];

    return serviceTypes.map((item) => ({
      type: RegistryItemType.SERVICE,
      value: item.value,
      key: `ServiceType.${item.key}`,
    }));
  }

  /**
   * Получить доступные КПП (Gates)
   * GateType определен на frontend, поэтому используем известные значения
   */
  getAvailableGates(): RegistryItem[] {
    // GateType определен на frontend, используем известные значения
    // Значения: 'gate-income' и 'gate-outcome'
    const gateTypes = [
      { value: "gate-income", key: "Income" },
      { value: "gate-outcome", key: "Outcome" },
    ];

    return gateTypes.map((item) => ({
      type: RegistryItemType.GATE,
      value: item.value,
      key: `GateType.${item.key}`,
    }));
  }

  /**
   * Получить доступные пункты мебельного производства
   */
  getAvailableFurniture(): RegistryItem[] {
    return [
      {
        type: RegistryItemType.FURNITURE,
        value: "furniture-orders",
        key: "FurnitureType.Orders",
      },
      {
        type: RegistryItemType.FURNITURE,
        value: "furniture-my-works",
        key: "FurnitureType.MyWorks",
      },
      {
        type: RegistryItemType.FURNITURE,
        value: "furniture-production-board",
        key: "FurnitureType.ProductionBoard",
      },
      {
        type: RegistryItemType.FURNITURE,
        value: "furniture-cutting-balances",
        key: "FurnitureType.CuttingBalances",
      },
      {
        type: RegistryItemType.FURNITURE,
        value: "furniture-work-time-report",
        key: "FurnitureType.WorkTimeReport",
      },
    ];
  }

  /**
   * Очистить кэш (для тестирования или принудительного обновления)
   */
  clearCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
  }
}
