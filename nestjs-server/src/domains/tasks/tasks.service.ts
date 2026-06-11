import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../auth/auth.types';
import { toMongoShape } from '../../common/serializers/mongo-response';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(user: AuthUser, taskId: string) {
    const task = await this.prisma.db.task.findFirst({
      where: {
        id: taskId,
        tenantId: user.tenantId ?? undefined,
      },
      include: {
        assignments: true,
      },
    });

    if (!task) {
      throw new NotFoundException({ error: 'Task not found' });
    }

    return {
      ...toMongoShape(task),
      _readSource: 'supabase-prisma',
    };
  }
}
