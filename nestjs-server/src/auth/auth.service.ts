import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { ADMIN_SLUG } from './auth.constants';

import { AuthUser } from './auth.types';



export type { AuthUser };



@Injectable()

export class AuthService {
  constructor(private readonly prisma: PrismaService) {}



  async loadAuthUser(userId: string): Promise<AuthUser | null> {

    const user = await this.prisma.withBypass(() =>

      this.prisma.user.findUnique({

        where: { id: userId },

        include: {

          department: {

            select: {

              id: true,

              name: true,

              slug: true,

              permissionPreset: true,

              pagePermissions: true,

            },

          },

        },

      }),

    );



    if (!user) return null;

    return {

      id: user.id,

      name: user.name,

      email: user.email,

      tenantId: user.tenantId,

      departmentId: user.department

        ? {

            id: user.department.id,

            name: user.department.name,

            slug: user.department.slug,

            permissionPreset: user.department.permissionPreset,

            pagePermissions: user.department.pagePermissions,

          }

        : null,

    };

  }



  async loadBypassAdminUser(): Promise<AuthUser | null> {

    const user = await this.prisma.withBypass(() =>

      this.prisma.user.findFirst({

        where: { department: { slug: ADMIN_SLUG } },

        include: {

          department: {

            select: {

              id: true,

              name: true,

              slug: true,

              permissionPreset: true,

              pagePermissions: true,

            },

          },

        },

      }),

    );



    if (!user) return null;

    return {

      id: user.id,

      name: user.name,

      email: user.email,

      tenantId: user.tenantId,

      departmentId: user.department

        ? {

            id: user.department.id,

            name: user.department.name,

            slug: user.department.slug,

            permissionPreset: user.department.permissionPreset,

            pagePermissions: user.department.pagePermissions,

          }

        : null,

    };

  }

}

