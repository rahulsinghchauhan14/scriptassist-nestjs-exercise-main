import { Injectable } from "@nestjs/common";
import { User } from "../entities/user.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

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

    async create(user: User): Promise<User> {
        return this.usersRepository.save(user);
    }
}