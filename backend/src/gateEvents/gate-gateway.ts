import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GateEventsService } from "./gateEvents.service";

interface GateClient {
  socketId: string;
  gateId: string;
  apiKey: string;
  connectedAt: Date;
  lastPing: Date;
}

interface GateCommand {
  action: "open" | "close";
  gateId: string;
  eventId: number;
  carNumber: string;
  reason: "income" | "outcome_approved" | "outcome_denied";
}

interface RegisterGateClientData {
  gateId: string;
  apiKey: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*", // Для локальной программы разрешаем любой origin
    credentials: false,
  },
  namespace: "/gate-control",
  transports: ["websocket", "polling"],
  path: "/socket.io/",
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class GateGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GateGateway.name);
  private gateClients = new Map<string, GateClient>();
  private readonly MAX_CLIENTS = 50;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => GateEventsService))
    private gateEventsService: GateEventsService,
  ) {
    const expectedGateId =
      this.configService.get<string>("GATE_ID") || "main-entrance";
    this.logger.log(`🚀 [GATEWAY] GateGateway создан`);
    this.logger.log(`🚀 [GATEWAY] Ожидаемый GATE_ID: ${expectedGateId}`);

    const gateClientEnabled =
      this.configService.get<string>("GATE_CLIENT_ENABLED") !== "false";
    if (gateClientEnabled) {
      this.startCleanupInterval();
    } else {
      this.logger.warn(
        `⚠️ [GATEWAY] GATE_CLIENT_ENABLED=false — мониторинг клиента шлагбаума отключён`,
      );
    }
  }

  // Вызывается после инициализации модуля
  onModuleInit() {
    const expectedGateId =
      this.configService.get<string>("GATE_ID") || "main-entrance";
    this.logger.log(`🚀 [GATEWAY] ==========================================`);
    this.logger.log(`🚀 [GATEWAY] GateGateway модуль инициализирован`);
    this.logger.log(`🚀 [GATEWAY] Namespace: /gate-control`);
    this.logger.log(`🚀 [GATEWAY] Path: /socket.io/`);
    this.logger.log(`🚀 [GATEWAY] Ожидаемый GATE_ID: ${expectedGateId}`);
    this.logger.log(`🚀 [GATEWAY] ==========================================`);
  }

  // Вызывается после инициализации WebSocket сервера
  afterInit(server: Server) {
    const expectedGateId =
      this.configService.get<string>("GATE_ID") || "main-entrance";
    const port = this.configService.get<string>("PORT") || "7009";
    const serverUrl =
      this.configService.get<string>("SERVER_URL") ||
      "https://jbi7-turon.osondastur.uz";

    this.logger.log(`🚀 [GATEWAY] ==========================================`);
    this.logger.log(`🚀 [GATEWAY] WebSocket сервер для шлагбаума запущен`);
    this.logger.log(`🚀 [GATEWAY] Namespace: /gate-control`);
    this.logger.log(`🚀 [GATEWAY] Path: /socket.io/`);
    this.logger.log(`🚀 [GATEWAY] Ожидаемый GATE_ID: ${expectedGateId}`);
    this.logger.log(`🚀 [GATEWAY] Порт сервера: ${port}`);
    this.logger.log(
      `🚀 [GATEWAY] Ожидаемый URL клиента: ${serverUrl}/gate-control`,
    );
    this.logger.log(`🚀 [GATEWAY] Готов к подключениям клиентов`);
    this.logger.log(`🚀 [GATEWAY] ==========================================`);

    // Логируем информацию о сервере
    if (server) {
      this.logger.log(`🚀 [GATEWAY] WebSocket Server объект инициализирован`);
      this.logger.log(
        `🚀 [GATEWAY] Engine: ${server.engine ? "готов" : "не готов"}`,
      );
    }
  }

  // Обработка подключения клиента
  handleConnection(client: Socket) {
    const clientIp =
      client.handshake.address ||
      client.request.socket.remoteAddress ||
      "unknown";
    const connectTime = new Date().toISOString();

    this.logger.log(`🔌 [ПОДКЛЮЧЕНИЕ] Новый клиент подключился:`);
    this.logger.log(`   Socket ID: ${client.id}`);
    this.logger.log(`   IP адрес: ${clientIp}`);
    this.logger.log(`   Время подключения: ${connectTime}`);

    // Безопасная проверка количества активных подключений в namespace
    const namespace = this.server?.of?.("/gate-control");
    const activeConnections =
      namespace?.sockets?.size ?? this.server?.sockets?.sockets?.size ?? 0;
    this.logger.log(`   Всего активных подключений: ${activeConnections}`);
    this.logger.log(
      `   Зарегистрированных клиентов шлагбаума: ${this.gateClients.size}`,
    );

    // Отправляем приветственное сообщение
    client.emit("connected", {
      message: "Подключение к серверу управления шлагбаумом установлено",
      timestamp: connectTime,
    });
  }

  // Обработка отключения клиента
  handleDisconnect(client: Socket) {
    const clientIp =
      client.handshake.address ||
      client.request.socket.remoteAddress ||
      "unknown";
    const disconnectTime = new Date().toISOString();
    const reason = (client as any).disconnectReason || "unknown";

    this.logger.log(`🔌 [ОТКЛЮЧЕНИЕ] Клиент отключился:`);
    this.logger.log(`   Socket ID: ${client.id}`);
    this.logger.log(`   IP адрес: ${clientIp}`);
    this.logger.log(`   Время отключения: ${disconnectTime}`);
    this.logger.log(`   Причина: ${reason}`);

    // Удаляем клиента из списка
    const clientInfo = Array.from(this.gateClients.values()).find(
      (c) => c.socketId === client.id,
    );

    if (clientInfo) {
      const connectionDuration = Math.round(
        (new Date().getTime() - clientInfo.connectedAt.getTime()) / 1000,
      );
      this.gateClients.delete(clientInfo.gateId);
      this.logger.log(
        `❌ [ОТКЛЮЧЕНИЕ] Клиент шлагбаума ${clientInfo.gateId} удален из списка`,
      );
      this.logger.log(
        `   Время подключения было: ${connectionDuration} секунд (${Math.round(connectionDuration / 60)} минут)`,
      );
      this.logger.log(
        `   Осталось зарегистрированных клиентов: ${this.gateClients.size}`,
      );

      // Если это был зарегистрированный клиент, логируем предупреждение
      if (reason === "transport close" || reason === "ping timeout") {
        this.logger.warn(
          `⚠️ [ПРОБЛЕМА С ИНТЕРНЕТОМ] Клиент ${clientInfo.gateId} отключился из-за проблем с соединением (${reason})`,
        );
      }
    } else {
      this.logger.log(
        `   Клиент не был зарегистрирован (только подключился, но не зарегистрировался)`,
      );
    }
  }

  // Регистрация клиента шлагбаума
  @SubscribeMessage("registerGateClient")
  async handleRegisterGateClient(
    @MessageBody() data: RegisterGateClientData,
    @ConnectedSocket() client: Socket,
  ) {
    const clientIp =
      client.handshake.address ||
      client.request.socket.remoteAddress ||
      "unknown";
    this.logger.log(`📝 [РЕГИСТРАЦИЯ] Попытка регистрации клиента:`);
    this.logger.log(`   Gate ID: ${data.gateId}`);
    this.logger.log(`   Socket ID: ${client.id}`);
    this.logger.log(`   IP адрес: ${clientIp}`);

    // Проверка API ключа
    const validApiKey = this.configService.get<string>("GATE_CLIENT_API_KEY");
    if (!data.apiKey || data.apiKey !== validApiKey) {
      this.logger.error(
        `❌ [РЕГИСТРАЦИЯ] Неверный API ключ от клиента: ${data.gateId} (IP: ${clientIp})`,
      );
      client.emit("registrationError", {
        message: "Неверный API ключ",
        code: "INVALID_API_KEY",
      });
      return;
    }

    // Проверка на существующего клиента с таким gateId
    const existingClient = this.gateClients.get(data.gateId);
    if (existingClient) {
      if (existingClient.socketId === client.id) {
        // Клиент уже зарегистрирован с этим socketId - повторная регистрация
        this.logger.warn(
          `⚠️ [РЕГИСТРАЦИЯ] Клиент ${data.gateId} уже зарегистрирован с этим socketId (${client.id}). Обновляем данные.`,
        );
        // Обновляем время подключения и ping
        existingClient.connectedAt = new Date();
        existingClient.lastPing = new Date();
        this.gateClients.set(data.gateId, existingClient);
      } else {
        // Клиент с таким gateId уже зарегистрирован с другим socketId
        this.logger.warn(
          `⚠️ [РЕГИСТРАЦИЯ] Клиент ${data.gateId} уже зарегистрирован с другим socketId (старый: ${existingClient.socketId}, новый: ${client.id}). Обновляем регистрацию.`,
        );
        // Удаляем старый сокет, если он еще существует
        const namespace = this.server?.of?.("/gate-control");
        if (namespace?.sockets) {
          const oldSocket = namespace.sockets.get(existingClient.socketId);
          if (oldSocket) {
            oldSocket.disconnect();
            this.logger.log(
              `   Старый сокет ${existingClient.socketId} отключен`,
            );
          }
        }
        // Обновляем регистрацию на новый socketId
        existingClient.socketId = client.id;
        existingClient.connectedAt = new Date();
        existingClient.lastPing = new Date();
        this.gateClients.set(data.gateId, existingClient);
      }
    } else {
      // Проверка лимита клиентов (только для новых клиентов)
      if (this.gateClients.size >= this.MAX_CLIENTS) {
        this.logger.warn(`Достигнут лимит клиентов: ${this.MAX_CLIENTS}`);
        client.emit("registrationError", {
          message: "Достигнут лимит подключенных клиентов",
          code: "CLIENT_LIMIT_REACHED",
        });
        return;
      }

      // Регистрация нового клиента
      const gateClient: GateClient = {
        socketId: client.id,
        gateId: data.gateId,
        apiKey: data.apiKey,
        connectedAt: new Date(),
        lastPing: new Date(),
      };

      this.gateClients.set(data.gateId, gateClient);
    }

    // Получаем зарегистрированного клиента (после всех обновлений)
    const registeredClient = this.gateClients.get(data.gateId);

    this.logger.log(
      `✅ Клиент ${data.gateId} успешно зарегистрирован (socketId: ${client.id})`,
    );
    this.logger.log(`📊 Всего подключенных клиентов: ${this.gateClients.size}`);
    const allClients = Array.from(this.gateClients.keys());
    this.logger.log(`📋 Список клиентов: ${allClients.join(", ")}`);

    // Отправляем подтверждение регистрации
    client.emit("registrationSuccess", {
      message: "Клиент успешно зарегистрирован",
      gateId: data.gateId,
      timestamp: new Date().toISOString(),
    });

    // Отправляем текущий статус
    if (registeredClient) {
      client.emit("gateStatus", {
        gateId: data.gateId,
        status: "connected",
        connectedAt: registeredClient.connectedAt,
      });
    }
  }

  // Ping от клиента для поддержания соединения
  @SubscribeMessage("ping")
  async handlePing(
    @MessageBody() data: { gateId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const gateClient = this.gateClients.get(data.gateId);
    if (gateClient) {
      const now = new Date();
      const timeSinceLastPing = Math.round(
        (now.getTime() - gateClient.lastPing.getTime()) / 1000,
      );
      gateClient.lastPing = now;

      // Логируем ping только если прошло больше 30 секунд (чтобы не засорять логи)
      if (timeSinceLastPing > 30) {
        this.logger.debug(
          `🏓 [PING] Получен ping от клиента ${data.gateId} (последний ping был ${timeSinceLastPing} секунд назад)`,
        );
      }

      client.emit("pong", { timestamp: now.toISOString() });
    } else {
      this.logger.warn(
        `⚠️ [PING] Получен ping от незарегистрированного клиента: ${data.gateId} (socketId: ${client.id})`,
      );
    }
  }

  // Подтверждение выполнения команды от клиента
  @SubscribeMessage("commandExecuted")
  async handleCommandExecuted(
    @MessageBody()
    data: { eventId: number; success: boolean; message?: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `Команда выполнена: eventId=${data.eventId}, success=${data.success}`,
    );

    if (data.success) {
      // Отмечаем событие как обработанное
      await this.gateEventsService.markEventAsProcessed(data.eventId);
    } else {
      this.logger.warn(`Ошибка выполнения команды: ${data.message}`);
    }
  }

  // Отправка команды на открытие/закрытие шлагбаума
  async sendGateCommand(command: GateCommand): Promise<boolean> {
    const gateClient = this.gateClients.get(command.gateId);

    if (!gateClient) {
      // Логируем список всех подключенных клиентов для диагностики
      const connectedClients = Array.from(this.gateClients.keys());
      this.logger.warn(`Клиент шлагбаума ${command.gateId} не найден`);
      this.logger.warn(
        `Подключенные клиенты: ${connectedClients.length > 0 ? connectedClients.join(", ") : "нет подключенных клиентов"}`,
      );
      this.logger.warn(
        `Ожидаемый GATE_ID из конфига: ${this.configService.get<string>("GATE_ID") || "main-entrance"}`,
      );
      return false;
    }

    try {
      // Отправляем команду клиенту
      this.server.to(gateClient.socketId).emit("gateCommand", command);

      this.logger.log(
        `Команда отправлена клиенту ${command.gateId} (socketId: ${gateClient.socketId}): ${command.action}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Ошибка отправки команды клиенту ${command.gateId}: ${error.message}`,
      );
      return false;
    }
  }

  // Получение списка подключенных клиентов
  getConnectedClients(): GateClient[] {
    return Array.from(this.gateClients.values());
  }

  // Проверка подключения клиента
  isClientConnected(gateId: string): boolean {
    return this.gateClients.has(gateId);
  }

  // Периодическая очистка мертвых соединений
  private startCleanupInterval() {
    // Периодическое логирование статуса подключенных клиентов
    setInterval(
      () => {
        if (this.gateClients.size > 0) {
          this.logger.log(
            `📊 [СТАТУС] Подключенных клиентов шлагбаума: ${this.gateClients.size}`,
          );
          for (const [gateId, client] of this.gateClients.entries()) {
            const timeSinceLastPing = Math.round(
              (new Date().getTime() - client.lastPing.getTime()) / 1000,
            );
            const connectionDuration = Math.round(
              (new Date().getTime() - client.connectedAt.getTime()) / 1000,
            );
            this.logger.log(
              `   - ${gateId}: подключен ${connectionDuration}с, последний ping ${timeSinceLastPing}с назад`,
            );
          }
        } else {
          this.logger.warn(
            `⚠️ [СТАТУС] Нет подключенных клиентов шлагбаума! Ожидается: ${this.configService.get<string>("GATE_ID") || "main-entrance"}`,
          );
        }
      },
      5 * 60 * 1000,
    ); // Каждые 5 минут

    // Проверка мертвых соединений
    setInterval(() => {
      const now = new Date();
      const timeout = 10 * 60 * 1000; // 10 минут

      for (const [gateId, client] of this.gateClients.entries()) {
        const timeSinceLastPing = now.getTime() - client.lastPing.getTime();

        if (timeSinceLastPing > timeout) {
          const minutesSinceLastPing = Math.round(timeSinceLastPing / 60000);
          this.logger.warn(
            `⚠️ [ПРОБЛЕМА С ИНТЕРНЕТОМ] Клиент ${gateId} не отвечает ${minutesSinceLastPing} минут, удаляем из списка`,
          );
          this.logger.warn(
            `   Последний ping был: ${client.lastPing.toISOString()}`,
          );
          this.gateClients.delete(gateId);

          // Отключаем сокет (с проверкой на существование namespace)
          const namespace = this.server?.of?.("/gate-control");
          if (namespace?.sockets) {
            const socket = namespace.sockets.get(client.socketId);
            if (socket) {
              socket.disconnect();
              this.logger.warn(
                `   Сокет ${client.socketId} принудительно отключен`,
              );
            }
          }
        } else if (timeSinceLastPing > 5 * 60 * 1000) {
          // Предупреждение если ping не было больше 5 минут
          const minutesSinceLastPing = Math.round(timeSinceLastPing / 60000);
          this.logger.warn(
            `⚠️ [ПРОБЛЕМА С ИНТЕРНЕТОМ] Клиент ${gateId} не отправлял ping ${minutesSinceLastPing} минут (возможны проблемы с интернетом)`,
          );
        }
      }
    }, 60000); // Проверяем каждую минуту
  }
}
