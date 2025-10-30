export class TaskStatsDto {
    total: number;
    completed: number;
    inProgress: number
    pending: number;
    highPriority: number;

    constructor(partial: Partial<TaskStatsDto>) {
        Object.assign(this, partial);
    }
}       