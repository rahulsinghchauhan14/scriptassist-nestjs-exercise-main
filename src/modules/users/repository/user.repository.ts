import { User } from "../entities/user.entity";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateUserDto } from "@modules/users/dto/create-user.dto";
import { UpdateUserDto } from "@modules/users/dto/update-user.dto";

@Injectable()

export class UsersRepository {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
    ){}

    async findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { email } });
    }

    async findById(id: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }

    async findAll(): Promise<User[]> {
        return this.usersRepository.find();
    }

    async findOne(id: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }

    async createAndSave(createUserDto: CreateUserDto): Promise<User> {
        const user: User = this.usersRepository.create(createUserDto);
        return this.usersRepository.save(user);
    }

    async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
        const user: User | null = await this.findOne(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return this.createAndSave({
            email: updateUserDto.email || user.email,
            name: updateUserDto.name || user.name,
            password: updateUserDto.password || user.password,
        });
    }

    async remove(id: string): Promise<void> {
        const user: User | null = await this.findOne(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        await this.usersRepository.delete(id);
    }
}