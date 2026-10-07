import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsNotEmpty,
} from "class-validator";
import { GateEventType } from "../gateEvent.model";

export class CameraEventDto {
  @ApiProperty({
    example: "01A123AA",
    description: "Госномер автомобиля",
  })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiProperty({
    example: "income",
    enum: GateEventType,
    description: "Тип события - въезд или выезд",
  })
  @IsEnum(GateEventType)
  eventType: GateEventType;

  @ApiProperty({
    example: 1738368000000,
    description: "Время события в миллисекундах",
  })
  @IsNumber()
  timestamp: number;

  @ApiProperty({
    example: "192.168.1.100",
    description: "IP адрес камеры",
  })
  @IsString()
  @IsNotEmpty()
  cameraIp: string;

  @ApiProperty({
    example: "car",
    description: "Тип транспортного средства",
    required: false,
  })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiProperty({
    example: "white",
    description: "Цвет автомобиля",
    required: false,
  })
  @IsOptional()
  @IsString()
  vehicleColor?: string;

  @ApiProperty({
    example: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    description: "Изображение автомобиля в base64",
    required: false,
  })
  @IsOptional()
  @IsString()
  imageBase64?: string;

  @ApiProperty({
    example: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    description: "Изображение номера автомобиля в base64",
    required: false,
  })
  @IsOptional()
  @IsString()
  plateImageBase64?: string;
}
