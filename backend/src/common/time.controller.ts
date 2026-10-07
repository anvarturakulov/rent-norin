import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("Время")
@Controller("time")
export class TimeController {
  @Get()
  now() {
    return { now: Date.now() };
  }
}
