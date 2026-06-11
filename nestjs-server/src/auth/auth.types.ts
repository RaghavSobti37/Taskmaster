export type DepartmentRef = {
  id: string;
  name: string;
  slug: string;
  permissionPreset?: string | null;
  pagePermissions?: string[];
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  tenantId?: string | null;
  departmentId?: DepartmentRef | null;
};
