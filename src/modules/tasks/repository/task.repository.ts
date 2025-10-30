import { InjectRepository } from "@nestjs/typeorm";
import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateTaskDto } from "@modules/tasks/dto/create-task.dto";
import { PaginatedResponse } from "@common/interfaces/pagination-result.interface";
import { PaginationOptions } from "@common/interfaces/pagination-options.interface";
import { DataSource, FindOptionsWhere, Repository, SelectQueryBuilder } from "typeorm";
import { TaskStatus } from "@modules/tasks/enums/task-status.enum";
import { TaskPriority } from "@modules/tasks/enums/task-priority.enum";
import { UpdateTaskDto } from "@modules/tasks/dto/update-task.dto";
import { Task } from "../entities/task.entity";
import { TaskStatsDto } from "../dto/task-stats.dto";

@Injectable()
export class TasksRepository {
    constructor(
        @InjectRepository(Task)
        private readonly tasksRepository: Repository<Task>,
        private readonly dataSource: DataSource,
    ) { }

    async createAndSave(createTaskDto: CreateTaskDto): Promise<Task> {
        const task: Task = this.tasksRepository.create({
            title: createTaskDto.title,
            description: createTaskDto.description,
            status: createTaskDto.status as TaskStatus,
            priority: createTaskDto.priority as TaskPriority,
            dueDate: createTaskDto.dueDate,
            userId: createTaskDto.userId,
        } as Task);
        return this.tasksRepository.save(task);
    }

    // find by status
    async findByStatus(status: TaskStatus): Promise<Task[]> {
        return this.tasksRepository.find({ where: { status } });
    }

    // find all tasks with pagination
    async findAll(
        paginationOptions: PaginationOptions,
    ): Promise<PaginatedResponse<Task>> {
        const { page = 1, limit = 10, status, priority } = paginationOptions || {};
        const skip: number = (page - 1) * limit;
        const take: number = limit;
        const where: FindOptionsWhere<Task> = {};
        if (status) {
            where.status = status as TaskStatus;
        }
        if (priority) {
            where.priority = priority as TaskPriority;
        }
        const [tasks, total] = await this.tasksRepository.findAndCount({
            skip,
            take,
            where,
            relations: ['user'],
            order: { createdAt: 'DESC' },
        });
        return {
            data: tasks,
            meta: {
                total,
                page: page ? page : 1,
                limit: limit ? limit : 10,
                totalPages: Math.ceil(total / (limit ? limit : 10)),
            },
        };
    }

    async findOne(id: string): Promise<Task> {
        const task: Task | null = await this.tasksRepository.findOne({ where: { id }, relations: ['user'] });
        if (!task) {
            throw new NotFoundException(`Task with ID ${id} not found`);
        }
        return task;
    }

    async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
        return this.dataSource.transaction("SERIALIZABLE", async (transactionalEntityManager) => {
            const repo: Repository<Task> = transactionalEntityManager.getRepository(Task);
            const existingTask: Task | null = await repo.findOne({ where: { id } });
            if (!existingTask) {
                throw new NotFoundException(`Task with ID ${id} not found`);
            }

            const originalStatus: TaskStatus = existingTask.status;
            Object.assign(existingTask, updateTaskDto);

            const updatedTask: Task = await repo.save(existingTask);

            return {
                ...updatedTask,
                statusChanged: originalStatus !== updatedTask.status,
            } as Task & { statusChanged: boolean };
        });
    }

    async remove(id: string): Promise<void> {
        return this.dataSource.transaction("SERIALIZABLE", async (transactionalEntityManager) => {
            try {
                const existingTask: Task | null = await this.tasksRepository.findOne({ where: { id } });
                if (!existingTask) {
                    throw new NotFoundException(`Task with ID ${id} not found`);
                }
                await this.tasksRepository.delete({ id: existingTask.id });
            } catch (error) {
                throw new Error('Failed to delete task');
            }
        });
    }

    private baseStatsQuery(): SelectQueryBuilder<Task> {
        return this.tasksRepository.createQueryBuilder('task')
            .select([
                'COUNT(task.id) AS total',
                'SUM(CASE WHEN task.status = :completed THEN 1 ELSE 0 END) AS completed',
                'SUM(CASE WHEN task.status = :inProgress THEN 1 ELSE 0 END) AS inProgress',
                'SUM(CASE WHEN task.status = :pending THEN 1 ELSE 0 END) AS pending',
                'SUM(CASE WHEN task.priority = :high THEN 1 ELSE 0 END) AS highPriority',
            ])
            .setParameters({
                completed: TaskStatus.COMPLETED,
                inProgress: TaskStatus.IN_PROGRESS,
                pending: TaskStatus.PENDING,
                high: TaskPriority.HIGH,
            });
    }

    async getTaskStats(userId?: string): Promise<TaskStatsDto> {
        const qb: SelectQueryBuilder<Task> = this.baseStatsQuery();

        // Optional: support per-user stats
        if (userId) qb.andWhere('task.userId = :userId', { userId });

        const result: Partial<TaskStatsDto> | undefined = await qb.getRawOne<Partial<TaskStatsDto>>();

        // Normalize numeric values (since SQL SUM() returns strings)
        return new TaskStatsDto({
            total: Number(result?.total) || 0,
            completed: Number(result?.completed) || 0,
            inProgress: Number(result?.inProgress) || 0,
            pending: Number(result?.pending) || 0,
            highPriority: Number(result?.highPriority) || 0,
        });
    }
}