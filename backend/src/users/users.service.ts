import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { User } from "./users.model";
import { InjectModel } from "@nestjs/sequelize";
import { CreateUserDto } from "./dto/createUser.dto";
import { BanUserDto } from "./dto/ban-user.dto";
import { UpdateUserDto } from "./dto/updateUser.dto";
import * as bcrypt from "bcryptjs";

@Injectable()
export class UsersService {
  constructor(@InjectModel(User) private userRepository: typeof User) {}

  async createUser(dto: CreateUserDto) {
    // Преобразуем null в undefined для enterpriseId, так как UserCreationAttrs не принимает null
    const userData = {
      ...dto,
      enterpriseId: dto.enterpriseId ?? undefined,
    };
    const user = await this.userRepository.create(userData);
    return user;
  }

  async getUsers() {
    const users = await this.userRepository.findAll({ include: { all: true } });
    return users;
  }

  async getNames() {
    const users = await this.userRepository.findAll();
    if (users && users.length > 0) {
      const names = users.map((item) => ({ id: item.id, name: item.name }));
      return names;
    }
    return [];
  }

  async getUserByEmail(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    return user;
  }

  async getUserById(id: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    return user;
  }

  async getUserByTelegramId(telegramId: string) {
    return await this.userRepository.findOne({
      where: { telegramId: String(telegramId) },
    });
  }

  async updateUserById(id: number, dto: UpdateUserDto) {
    const user = await this.userRepository.findByPk(id);
    const {
      email,
      password,
      name,
      banned,
      banReason,
      role,
      sectionId,
      telegramId,
      enterpriseId,
      isSuperUser,
      allowedStorageIds,
      superKassir,
      referencePermissions,
    } = dto;
    const hashPassword = await bcrypt.hash(dto.password, 10);
    if (user) {
      user.email = email;
      user.password = user.password != password ? hashPassword : password;
      user.name = name;
      user.role = role;
      user.banned = banned;
      user.banReason = banReason;
      // Обновляем sectionId только если он передан
      if (sectionId !== undefined) {
        user.sectionId = sectionId;
      }
      user.telegramId = telegramId;
      // Обновляем enterpriseId, преобразуя undefined в null для Sequelize
      user.enterpriseId = enterpriseId ?? null;
      // Обновляем isSuperUser, если оно передано
      if (isSuperUser !== undefined) {
        user.isSuperUser = isSuperUser;
      }
      // Обновляем allowedStorageIds, если оно передано
      if (allowedStorageIds !== undefined) {
        user.allowedStorageIds = allowedStorageIds ?? null;
      }
      // Обновляем superKassir, если оно передано
      if (superKassir !== undefined) {
        user.superKassir = superKassir;
      }
      if (referencePermissions !== undefined) {
        user.referencePermissions = referencePermissions ?? null;
      }
      await user.save();
      return user;
    }
    throw new HttpException("Пользователь не нашлась", HttpStatus.NOT_FOUND);
  }

  async getUserRoleByEmail(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (user) {
      return user.role;
    }
    throw new HttpException("Роли не нашлись", HttpStatus.NOT_FOUND);
  }

  async banUser(dto: BanUserDto) {
    const user = await this.userRepository.findByPk(dto.id);
    if (user) {
      user.banned = !user.banned;
      user.banReason = dto.reason;
      await user.save();
      return user;
    }
    throw new HttpException("Пользователь не нашлась", HttpStatus.NOT_FOUND);
  }
}
