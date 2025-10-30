import { Injectable, NotFoundException } from '@nestjs/common';

import { Task } from '@modules/tasks/entities/task.entity';
import { CreateTaskDto } from '@modules/tasks/dto/create-task.dto';
import { UpdateTaskDto } from '@modules/tasks/dto/update-task.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskStatus } from '@modules/tasks/enums/task-status.enum';
import { TasksRepository } from '@modules/tasks/repository/task.repository';
import { PaginatedResponse } from '@common/interfaces/pagination-result.interface';
import { PaginationOptions } from '@common/interfaces/pagination-options.interface';
import { TaskStatsDto } from './dto/task-stats.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    @InjectQueue('task-processing')
    private taskQueue: Queue,
  ) { }

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    let savedTask: Task;
    // save and handle business logic in the repository
    savedTask = await this.tasksRepository.createAndSave(createTaskDto);
    try {
      // add to queue
      this.taskQueue.add('task-status-update', {
        taskId: savedTask.id,
        status: savedTask.status,
      });
    } catch (error) {
      throw new Error('Failed to add task to queue');
    }

    return savedTask;
  }

  async findAll(paginationOptions: PaginationOptions): Promise<PaginatedResponse<Task>> {
    return this.tasksRepository.findAll(paginationOptions);
  }

  async findOne(id: string): Promise<Task> {
    return this.tasksRepository.findOne(id);
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const updatedTask: Record<string, any> = await this.tasksRepository.update(id, updateTaskDto);
    if (updatedTask.statusChanged) {
      try {
        this.taskQueue.add('task-status-update', {
          taskId: updatedTask.id,
          status: updatedTask.status,
        });
      } catch (error) {
        throw new Error('Failed to add task to queue');
      }
    }
    return updatedTask as Task;
  }

  async remove(id: string): Promise<void> {
    return this.tasksRepository.remove(id);
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    return this.tasksRepository.findByStatus(status);
  }

  async updateStatus(id: string, status: string): Promise<Task> {
    // This method will be called by the task processor
    return this.tasksRepository.update(id, { status: status as TaskStatus });
  }

  async getStats(): Promise<TaskStatsDto> {
    return this.tasksRepository.getTaskStats();
  }
}