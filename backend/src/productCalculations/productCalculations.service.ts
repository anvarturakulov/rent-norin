import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ProductCalculation } from "./productCalculation.model";
import { Reference } from "src/references/reference.model";
import { CreateProductCalculationDto } from "./dto/create-product-calculation.dto";
import { UpdateProductCalculationDto } from "./dto/update-product-calculation.dto";
import {
  ProductQuantityInput,
  CalculateMaterialsInput,
  MaterialCalculationResult,
} from "./interfaces/product-calculation.interfaces";
import { Op } from "sequelize";

@Injectable()
export class ProductCalculationsService {
  constructor(
    @InjectModel(ProductCalculation)
    private productCalculationModel: typeof ProductCalculation,
    @InjectModel(Reference)
    private referenceModel: typeof Reference,
  ) {}

  async create(
    createProductCalculationDto: CreateProductCalculationDto,
    userEnterpriseId?: number,
    isSuperUser?: boolean,
  ): Promise<ProductCalculation> {
    // Проверяем права доступа: пользователь может создавать только для своей организации
    if (
      !isSuperUser &&
      userEnterpriseId &&
      createProductCalculationDto.enterpriseId !== userEnterpriseId
    ) {
      throw new ForbiddenException(
        "Вы можете создавать калькуляции только для своей организации",
      );
    }

    // Проверяем, что продукт и материал существуют
    const [product, material] = await Promise.all([
      this.referenceModel.findByPk(createProductCalculationDto.productId),
      this.referenceModel.findByPk(createProductCalculationDto.materialId),
    ]);

    if (!product) {
      throw new NotFoundException(
        `Продукт с ID ${createProductCalculationDto.productId} не найден`,
      );
    }

    if (!material) {
      throw new NotFoundException(
        `Материал с ID ${createProductCalculationDto.materialId} не найден`,
      );
    }

    // Проверяем, что такая калькуляция уже не существует
    const existingCalculation = await this.productCalculationModel.findOne({
      where: {
        productId: createProductCalculationDto.productId,
        materialId: createProductCalculationDto.materialId,
        enterpriseId: createProductCalculationDto.enterpriseId,
      },
    });

    if (existingCalculation) {
      throw new BadRequestException(
        "Калькуляция для данного продукта и материала уже существует",
      );
    }

    return this.productCalculationModel.create(createProductCalculationDto);
  }

  async findAll(
    enterpriseId?: number,
    isSuperUser?: boolean,
  ): Promise<ProductCalculation[]> {
    const where: any = {};
    // Если не суперпользователь, показываем только расчеты своей организации
    if (!isSuperUser && enterpriseId !== undefined) {
      where.enterpriseId = enterpriseId;
    } else if (enterpriseId !== undefined) {
      where.enterpriseId = enterpriseId;
    }
    return this.productCalculationModel.findAll({
      where,
      include: [
        { model: Reference, as: "product" },
        { model: Reference, as: "material" },
      ],
    });
  }

  async findByProductId(
    productId: number,
    enterpriseId?: number,
    isSuperUser?: boolean,
  ): Promise<ProductCalculation[]> {
    const where: any = { productId };
    // Если не суперпользователь, показываем только расчеты своей организации
    if (!isSuperUser && enterpriseId !== undefined) {
      where.enterpriseId = enterpriseId;
    } else if (enterpriseId !== undefined) {
      where.enterpriseId = enterpriseId;
    }
    return this.productCalculationModel.findAll({
      where,
      include: [
        { model: Reference, as: "product" },
        { model: Reference, as: "material" },
      ],
    });
  }

  async findOne(id: number): Promise<ProductCalculation> {
    const calculation = await this.productCalculationModel.findByPk(id, {
      include: [
        { model: Reference, as: "product" },
        { model: Reference, as: "material" },
      ],
    });

    if (!calculation) {
      throw new NotFoundException(`Калькуляция с ID ${id} не найдена`);
    }

    return calculation;
  }

  async update(
    id: number,
    updateProductCalculationDto: UpdateProductCalculationDto,
    userEnterpriseId?: number,
    isSuperUser?: boolean,
  ): Promise<ProductCalculation> {
    const calculation = await this.findOne(id);

    // Проверяем права доступа: пользователь может редактировать только расчеты своей организации
    if (
      !isSuperUser &&
      userEnterpriseId &&
      calculation.enterpriseId !== userEnterpriseId
    ) {
      throw new ForbiddenException(
        "Вы можете редактировать только калькуляции своей организации",
      );
    }

    // Если пользователь пытается изменить enterpriseId, проверяем права
    if (updateProductCalculationDto.enterpriseId !== undefined) {
      if (
        !isSuperUser &&
        userEnterpriseId &&
        updateProductCalculationDto.enterpriseId !== userEnterpriseId
      ) {
        throw new ForbiddenException(
          "Вы не можете изменить организацию калькуляции",
        );
      }
      if (!isSuperUser && !userEnterpriseId) {
        // Если enterpriseId не указан, устанавливаем из пользователя
        updateProductCalculationDto.enterpriseId = calculation.enterpriseId;
      }
    }

    // Если обновляются productId или materialId, проверяем их существование
    if (updateProductCalculationDto.productId) {
      const product = await this.referenceModel.findByPk(
        updateProductCalculationDto.productId,
      );
      if (!product) {
        throw new NotFoundException(
          `Продукт с ID ${updateProductCalculationDto.productId} не найден`,
        );
      }
    }

    if (updateProductCalculationDto.materialId) {
      const material = await this.referenceModel.findByPk(
        updateProductCalculationDto.materialId,
      );
      if (!material) {
        throw new NotFoundException(
          `Материал с ID ${updateProductCalculationDto.materialId} не найден`,
        );
      }
    }

    const nextProductId =
      updateProductCalculationDto.productId ?? calculation.productId;
    const nextMaterialId =
      updateProductCalculationDto.materialId ?? calculation.materialId;
    const nextEnterpriseId =
      updateProductCalculationDto.enterpriseId ?? calculation.enterpriseId;

    const duplicate = await this.productCalculationModel.findOne({
      where: {
        productId: nextProductId,
        materialId: nextMaterialId,
        enterpriseId: nextEnterpriseId,
        id: { [Op.ne]: id },
      },
    });

    if (duplicate) {
      throw new BadRequestException(
        "Калькуляция для данного продукта и материала уже существует на выбранном предприятии",
      );
    }

    await calculation.update(updateProductCalculationDto);
    return this.findOne(id);
  }

  async remove(
    id: number,
    userEnterpriseId?: number,
    isSuperUser?: boolean,
  ): Promise<void> {
    const calculation = await this.findOne(id);

    // Проверяем права доступа: пользователь может удалять только расчеты своей организации
    if (
      !isSuperUser &&
      userEnterpriseId &&
      calculation.enterpriseId !== userEnterpriseId
    ) {
      throw new ForbiddenException(
        "Вы можете удалять только калькуляции своей организации",
      );
    }

    await calculation.destroy();
  }

  /**
   * Рассчитывает материалы на основе готовой продукции
   * @param input Данные для расчета (массив продуктов с количествами)
   * @returns Массив материалов с общими количествами и расшифровкой по продуктам
   */
  async calculateMaterials(
    input: CalculateMaterialsInput,
  ): Promise<MaterialCalculationResult[]> {
    const { products } = input;

    if (!products || products.length === 0) {
      return [];
    }

    // Получаем все калькуляции для указанных продуктов
    const productIds = products.map((p) => p.productId);
    const where: any = { productId: productIds };
    if (input.enterpriseId !== undefined) {
      where.enterpriseId = input.enterpriseId;
    }

    const calculations = await this.productCalculationModel.findAll({
      where,
      include: [
        { model: Reference, as: "product" },
        { model: Reference, as: "material" },
      ],
    });

    // Группируем материалы по materialId и суммируем количества
    const materialTotals = new Map<number, MaterialCalculationResult>();

    for (const product of products) {
      const productCalculations = calculations.filter(
        (calc) => calc.productId === product.productId,
      );

      for (const calculation of productCalculations) {
        const materialId = calculation.materialId;
        const materialName =
          calculation.material?.name || `Материал ${materialId}`;
        const productName =
          calculation.product?.name || `Продукт ${product.productId}`;
        const requiredQuantity = calculation.quantityPerUnit * product.quantity;

        if (materialTotals.has(materialId)) {
          const existing = materialTotals.get(materialId)!;
          existing.totalQuantity += requiredQuantity;
          existing.productBreakdown.push({
            productId: product.productId,
            productName,
            quantity: product.quantity,
            requiredQuantity,
          });
        } else {
          materialTotals.set(materialId, {
            materialId,
            materialName,
            totalQuantity: requiredQuantity,
            productBreakdown: [
              {
                productId: product.productId,
                productName,
                quantity: product.quantity,
                requiredQuantity,
              },
            ],
          });
        }
      }
    }

    return Array.from(materialTotals.values());
  }
}
