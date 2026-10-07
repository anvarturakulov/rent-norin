import { ApiProperty } from "@nestjs/swagger";

export class IsapiEventDto {
  @ApiProperty({
    example: "192.168.100.64",
    description: "IP адрес камеры",
  })
  ipAddress: string;

  @ApiProperty({
    example: "2025-01-24T12:30:45+05:00",
    description: "Время события в ISO формате",
  })
  dateTime: string;

  @ApiProperty({
    example: "ANPR",
    description: "Тип события",
  })
  eventType: string;

  @ApiProperty({
    example: "01B895BB",
    description: "Распознанный номер автомобиля",
  })
  licensePlate: string;

  @ApiProperty({
    example: "UZB",
    description: "Страна номера",
    required: false,
  })
  country?: string;

  @ApiProperty({
    example: "white",
    description: "Цвет автомобиля",
    required: false,
  })
  vehicleColor?: string;

  @ApiProperty({
    example: "car",
    description: "Тип транспортного средства",
    required: false,
  })
  vehicleType?: string;

  @ApiProperty({
    example: "entrance",
    description: "Направление движения (entrance/exit)",
  })
  direction: string;

  @ApiProperty({
    example: 95,
    description: "Уровень уверенности распознавания",
    required: false,
  })
  confidenceLevel?: number;

  @ApiProperty({
    example: 1,
    description: "Номер полосы",
    required: false,
  })
  laneNo?: number;

  @ApiProperty({
    example: "ch01_20250124123045_ANPR",
    description: "Имя файла изображения",
    required: false,
  })
  picName?: string;

  @ApiProperty({
    example: "base64_image_data",
    description: "Изображение в base64 формате",
    required: false,
  })
  imageData?: string;
}

export class IsapiAnprDto {
  @ApiProperty({
    example: "01B895BB",
    description: "Распознанный номер автомобиля",
  })
  licensePlate: string;

  @ApiProperty({
    example: "ch01_20250124123045_ANPR",
    description: "Имя файла изображения",
    required: false,
  })
  picName?: string;

  @ApiProperty({
    example: "UZB",
    description: "Страна номера",
    required: false,
  })
  country?: string;

  @ApiProperty({
    example: 95,
    description: "Уровень уверенности распознавания",
    required: false,
  })
  confidenceLevel?: number;

  @ApiProperty({
    example: "white",
    description: "Цвет номера",
    required: false,
  })
  plateColor?: string;

  @ApiProperty({
    example: "white",
    description: "Цвет автомобиля",
    required: false,
  })
  vehicleColor?: string;

  @ApiProperty({
    example: "car",
    description: "Тип транспортного средства",
    required: false,
  })
  vehicleType?: string;

  @ApiProperty({
    example: 1,
    description: "Номер полосы",
    required: false,
  })
  laneNo?: number;

  @ApiProperty({
    example: "entrance",
    description: "Направление движения (entrance/exit)",
  })
  direction: string;
}
