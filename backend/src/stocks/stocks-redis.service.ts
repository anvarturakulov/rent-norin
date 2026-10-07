import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { ConfigService } from "@nestjs/config";
import { Schet } from "src/interfaces/report.interface";

interface CurrentStockData {
  totalQuantity: number;
  totalSum: number;
  totalSumUsd: number;
  reservedQuantity: number;
  availableQuantity: number;
  availableSum: number;
  availableSumUsd: number;
  reservations: Record<string, number>;
  lastUpdate: number;
}

@Injectable()
export class StocksRedisService {
  private redis: Redis | null = null;
  private redisAvailable = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 5000; // 5 секунд

  private schetsWithOneSubconto = [
    Schet.S40,
    Schet.S50,
    Schet.S60,
    Schet.S66,
    Schet.S67,
    Schet.S71,
    Schet.S65,
    Schet.S64,
    Schet.S68,
    Schet.S41,
  ];

  constructor(private configService: ConfigService) {
    // Временно отключаем автоматическую инициализацию
    // this.initializeRedis();
  }

  // Метод для ручной инициализации Redis
  public async initRedis() {
    await this.initializeRedis();

    // Ждем, пока Redis полностью подключится и отвечает
    if (this.redis) {
      try {
        await this.redis.ping();
        this.redisAvailable = true;
      } catch (error) {
        this.redisAvailable = false;
      }
    }
  }

  private async initializeRedis() {
    try {
      // Получаем конфигурацию из .development.env или .production.env
      const redisHost = this.configService.get<string>("REDIS_HOST");
      const redisPort = this.configService.get<number>("REDIS_PORT");
      const redisPassword = this.configService.get<string>("REDIS_PASSWORD");
      const redisDb = this.configService.get<number>("REDIS_DB");

      this.redis = new Redis({
        host: redisHost || "localhost",
        port: redisPort || 6379,
        password: redisPassword,
        db: redisDb || 0,
        maxRetriesPerRequest: 3,
        lazyConnect: true, // Не подключаться сразу
        enableOfflineQueue: false,
        connectTimeout: 10000,
        commandTimeout: 5000,
        keepAlive: 30000,
        family: 4, // IPv4
        reconnectOnError: (err) => {
          const targetError = "READONLY";
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
      });

      // Обработка ошибок подключения
      this.redis.on("error", (error) => {
        this.redisAvailable = false;
        this.scheduleReconnect();
      });

      this.redis.on("connect", () => {
        this.redisAvailable = true;
        this.reconnectAttempts = 0; // Сбрасываем счетчик при успешном подключении
      });

      this.redis.on("ready", () => {
        this.redisAvailable = true;
        this.reconnectAttempts = 0;
      });

      this.redis.on("close", () => {
        this.redisAvailable = false;
        this.scheduleReconnect();
      });

      this.redis.on("reconnecting", (delay) => {});

      // Пытаемся подключиться
      await this.redis.connect();
    } catch (error) {
      this.redis = null;
      this.redisAvailable = false;
      this.scheduleReconnect();
    }
  }

  // Метод для планирования переподключения
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    this.reconnectAttempts++;

    setTimeout(async () => {
      try {
        if (this.redis) {
          await this.redis.disconnect();
        }
        await this.initializeRedis();
      } catch (error) {}
    }, this.RECONNECT_DELAY);
  }

  // Метод для принудительного переподключения
  public async forceReconnect() {
    this.reconnectAttempts = 0;
    if (this.redis) {
      await this.redis.disconnect();
    }
    await this.initializeRedis();
  }

  // Метод для проверки здоровья соединения
  public async healthCheck(): Promise<boolean> {
    if (!this.redis || !this.redisAvailable) {
      return false;
    }

    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      this.redisAvailable = false;
      return false;
    }
  }

  private getCurrentStockKey(
    schet: Schet,
    firstSubcontoId: number | null,
    secondSubcontoId: number | null,
  ): string {
    const actualSecondSubcontoId = this.schetsWithOneSubconto.includes(schet)
      ? null
      : secondSubcontoId;

    return actualSecondSubcontoId === null
      ? `current:stock:${schet}:${firstSubcontoId}`
      : `current:stock:${schet}:${firstSubcontoId}:${actualSecondSubcontoId}`;
  }

  async updateCurrentStock(
    schet: Schet,
    firstSubcontoId: number | null,
    secondSubcontoId: number | null,
    totalQuantity: number,
    totalSum: number,
    totalSumUsd: number,
  ) {
    // Фильтруем только счета S10 (материалы) и S28 (готовая продукция)
    if (schet !== Schet.S10 && schet !== Schet.S28) {
      return;
    }

    if (!this.redis || !this.redisAvailable) {
      return;
    }

    try {
      const key = this.getCurrentStockKey(
        schet,
        firstSubcontoId,
        secondSubcontoId,
      );

      const stockData: CurrentStockData = {
        totalQuantity,
        totalSum,
        totalSumUsd,
        reservedQuantity: 0,
        availableQuantity: totalQuantity,
        availableSum: totalSum,
        availableSumUsd: totalSumUsd,
        reservations: {},
        lastUpdate: Date.now(),
      };

      await this.redis.set(key, JSON.stringify(stockData));
    } catch (error) {}
  }

  async getCurrentStock(
    schet: Schet,
    firstSubcontoId: number | null,
    secondSubcontoId: number | null,
  ): Promise<CurrentStockData | null> {
    if (!this.redis || !this.redisAvailable) {
      return null;
    }

    try {
      const key = this.getCurrentStockKey(
        schet,
        firstSubcontoId,
        secondSubcontoId,
      );
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  // Батчинг запросов к Redis для оптимизации производительности
  async getCurrentStocksBatch(
    schet: Schet,
    itemIds: string[],
    firstSubcontoId: number,
  ): Promise<Record<string, CurrentStockData>> {
    if (!this.redis || !this.redisAvailable) {
      return {};
    }

    if (itemIds.length === 0) {
      return {};
    }

    try {
      const pipeline = this.redis.pipeline();
      const keys: string[] = [];

      // Подготавливаем все ключи для запроса
      for (const itemId of itemIds) {
        let actualFirst: number | null;
        let actualSecond: number | null;

        if (this.schetsWithOneSubconto.includes(schet)) {
          // Для счетов с одним субконто
          actualFirst = Number(itemId);
          actualSecond = null;
        } else {
          // Для счетов с двумя субконто (товары)
          const [warehouseId, productId] = itemId.split(":").map(Number);
          actualFirst = warehouseId;
          actualSecond = productId;
        }

        const key = this.getCurrentStockKey(schet, actualFirst, actualSecond);
        keys.push(key);
        pipeline.get(key);
      }

      // Выполняем все запросы одним батчем
      const results = await pipeline.exec();

      const stocks: Record<string, CurrentStockData> = {};

      if (results) {
        results.forEach((result, index) => {
          if (result && result[1] && result[1] !== null) {
            try {
              const stockData = JSON.parse(result[1] as string);
              stocks[itemIds[index]] = stockData;
            } catch (error) {}
          }
        });
      }

      return stocks;
    } catch (error) {
      return {};
    }
  }

  async invalidateCurrentStock(
    schet: Schet,
    firstSubcontoId: number | null,
    secondSubcontoId: number | null,
  ) {
    if (!this.redis || !this.redisAvailable) {
      return;
    }

    try {
      const key = this.getCurrentStockKey(
        schet,
        firstSubcontoId,
        secondSubcontoId,
      );
      await this.redis.del(key);
    } catch (error) {}
  }

  async populateFromStocks(stockRepository: any) {
    // Если Redis объект потерялся, пытаемся переподключиться
    if (!this.redis) {
      try {
        await this.initRedis();
      } catch (error) {
        return;
      }
    }

    if (!this.redis || !this.redisAvailable) {
      return;
    }

    try {
      // Очищаем все ключи, связанные с остатками
      await this.clearStockCache();
    } catch (error) {}

    try {
      // Получаем только записи для счетов S10 (материалы) и S28 (готовая продукция)
      const allStocks = await stockRepository.findAll({
        attributes: [
          "schet",
          "firstSubcontoId",
          "secondSubcontoId",
          "remainCount",
          "remainTotal",
          "date",
          "id",
        ],
        where: {
          schet: [Schet.S10, Schet.S28], // Фильтруем только нужные счета
        },
        order: [
          ["date", "DESC"],
          ["id", "DESC"],
        ],
        raw: true,
      });

      // Группируем по ключу и берем последние записи
      const stockMap = new Map();
      for (const stock of allStocks) {
        const key = `${stock.schet}:${stock.firstSubcontoId}:${stock.secondSubcontoId}`;
        if (!stockMap.has(key)) {
          stockMap.set(key, stock);
        }
      }

      const latestStocks = Array.from(stockMap.values());

      if (latestStocks.length === 0) {
        return;
      }

      const pipeline = this.redis.pipeline();
      let count = 0;

      for (const stock of latestStocks) {
        // Записываем только товары со счетов S10 и S28, включая с нулевыми остатками
        const key = this.getCurrentStockKey(
          stock.schet,
          stock.firstSubcontoId,
          stock.secondSubcontoId,
        );
        pipeline.set(
          key,
          JSON.stringify({
            totalQuantity: stock.remainCount,
            totalSum: stock.remainTotal,
            reservedQuantity: 0,
            availableQuantity: stock.remainCount,
            availableSum: stock.remainTotal,
            reservations: {},
            lastUpdate: Date.now(),
          }),
        );
        count++;
      }

      await pipeline.exec();
    } catch (error) {}
  }

  // Метод для очистки кэша остатков (записи теперь не имеют TTL)
  async clearStockCache() {
    if (!this.redis || !this.redisAvailable) {
      return;
    }

    try {
      // Получаем все ключи, которые начинаются с 'current:stock:'
      const keys = await this.redis.keys("current:stock:*");

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      throw error;
    }
  }

  // Получение последнего остатка из БД
  async getLatestStockFromDatabase(
    schet: Schet,
    firstSubcontoId: number | null,
    secondSubcontoId: number | null,
  ): Promise<{ remainCount: number; remainTotal: number } | null> {
    // Этот метод будет вызываться из StocksService
    // Возвращаем null, так как логика в StocksService
    return null;
  }

  // Проверка доступности Redis
  isRedisAvailable(): boolean {
    return this.redisAvailable;
  }

  // Получение статистики кэша
  async getCacheStats() {
    if (!this.redis || !this.redisAvailable) {
      return {
        available: false,
        message: "Redis not available",
        totalKeys: 0,
        sampleKeys: [],
        sampleData: [],
      };
    }

    try {
      const keys = await this.redis.keys("current:stock:*");
      const totalKeys = keys.length;

      // Берем первые 5 ключей для примера
      const sampleKeys = keys.slice(0, 5);
      const sampleData: Array<{
        key: string;
        data: {
          totalQuantity: number;
          totalSum: number;
          lastUpdate: string;
        };
      }> = [];

      for (const key of sampleKeys) {
        const data = await this.redis.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          sampleData.push({
            key,
            data: {
              totalQuantity: parsed.totalQuantity,
              totalSum: parsed.totalSum,
              lastUpdate: new Date(parsed.lastUpdate).toISOString(),
            },
          });
        }
      }

      return {
        available: true,
        totalKeys,
        sampleKeys,
        sampleData,
        message: `Found ${totalKeys} stock records in Redis`,
      };
    } catch (error) {
      return {
        available: false,
        message: `Error getting cache stats: ${error.message}`,
        totalKeys: 0,
        sampleKeys: [],
        sampleData: [],
      };
    }
  }

  // Получение всех ключей резервов для конкретного агента
  async getReservationKeysForAgent(agentId: string): Promise<string[]> {
    if (!this.redis || !this.redisAvailable) {
      return [];
    }

    try {
      // Получаем все ключи текущих остатков
      const stockKeys = await this.redis.keys("current:stock:*");
      const reservationKeys: string[] = [];

      for (const key of stockKeys) {
        try {
          const stockData = await this.redis.get(key);
          if (stockData) {
            const stock = JSON.parse(stockData);
            if (
              stock.reservations &&
              stock.reservations[agentId] &&
              stock.reservations[agentId] > 0
            ) {
              reservationKeys.push(key);
            }
          }
        } catch (error) {}
      }

      return reservationKeys;
    } catch (error) {
      return [];
    }
  }

  // Освобождение резерва по конкретному ключу
  async releaseReservationByKey(key: string): Promise<boolean> {
    if (!this.redis || !this.redisAvailable) {
      return false;
    }

    try {
      const stockData = await this.redis.get(key);
      if (!stockData) {
        return false;
      }

      const stock = JSON.parse(stockData);
      const hasReservations =
        stock.reservations && Object.keys(stock.reservations).length > 0;

      if (!hasReservations) {
        return true; // Возвращаем true, так как резервов нет
      }

      // Сбрасываем все резервы
      const totalReserved = stock.reservedQuantity || 0;
      stock.reservedQuantity = 0;
      stock.availableQuantity = stock.totalQuantity;
      stock.availableSum = stock.totalSum;
      stock.reservations = {};
      stock.lastUpdate = Date.now();

      await this.redis.set(key, JSON.stringify(stock));
      return true;
    } catch (error) {
      return false;
    }
  }

  // Очистка всех резервов агента
  async clearAllAgentReservations(
    agentId: string,
  ): Promise<{ success: boolean; clearedCount: number }> {
    if (!this.redis || !this.redisAvailable) {
      return { success: false, clearedCount: 0 };
    }

    try {
      // Получаем все ключи текущих остатков
      const stockKeys = await this.redis.keys("current:stock:*");
      let clearedCount = 0;

      for (const key of stockKeys) {
        try {
          const result = await this.redis.eval(
            `
            local key = KEYS[1]
            local agentId = ARGV[1]
            
            local stockData = redis.call('GET', key)
            if not stockData then
              return 0
            end
            
            local stock = cjson.decode(stockData)
            local agentReservation = stock.reservations[agentId] or 0
            
            if agentReservation > 0 then
              -- Освобождаем резерв агента
              stock.reservedQuantity = stock.reservedQuantity - agentReservation
              stock.availableQuantity = stock.availableQuantity + agentReservation
              stock.availableSum = stock.totalSum * (stock.availableQuantity / stock.totalQuantity)
              stock.reservations[agentId] = nil
              stock.lastUpdate = ARGV[2]
              
              redis.call('SET', key, cjson.encode(stock))
              return agentReservation
            end
            
            return 0
          `,
            1,
            key,
            agentId,
            Date.now().toString(),
          );

          if (typeof result === "number" && result > 0) {
            clearedCount++;
          }
        } catch (error) {}
      }

      return { success: true, clearedCount };
    } catch (error) {
      return { success: false, clearedCount: 0 };
    }
  }
}
