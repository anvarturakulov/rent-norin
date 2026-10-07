import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { User } from "./users.model";
import { Roles } from "src/auth/roles-auth.decorator";
import { RolesGuard } from "src/auth/roles.guard";
import { BanUserDto } from "./dto/ban-user.dto";
import { UpdateUserDto } from "./dto/updateUser.dto";
import { UserRoles } from "src/interfaces/user.interface";

@ApiTags("Пользователи")
@Controller("users")
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({ summary: "Получение всех пользователей" })
  @ApiResponse({ status: 200, type: [User] })
  @Roles(UserRoles.ADMINGLOBAL)
  @UseGuards(RolesGuard)
  @Get("all")
  getAll() {
    return this.usersService.getUsers();
  }

  @ApiOperation({ summary: "Получение пользователя по id" })
  @ApiResponse({ status: 200, type: [User] })
  @Roles(UserRoles.ADMINGLOBAL)
  @UseGuards(RolesGuard)
  @Get("/getUserById/:id")
  getUser(@Param("id") id: number) {
    return this.usersService.getUserById(id);
  }

  @ApiOperation({ summary: "Забанить пользователя" })
  @Roles(UserRoles.ADMINGLOBAL)
  @UseGuards(RolesGuard)
  @Patch("/ban")
  banUser(@Body() dto: BanUserDto) {
    return this.usersService.banUser(dto);
  }

  @ApiOperation({ summary: "Обновить пользователя" })
  @Roles(UserRoles.ADMINGLOBAL)
  @UseGuards(RolesGuard)
  @Patch(":id")
  saveUser(@Param("id") id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUserById(id, dto);
  }

  @ApiOperation({ summary: "Получение всех имен пользователей" })
  @ApiResponse({ status: 200, type: [User] })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/names")
  getNames() {
    return this.usersService.getNames();
  }
}
