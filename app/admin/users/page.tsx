"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";

type UserRole = "USER" | "ADMIN";
type UserStatus = "ACTIVE" | "INACTIVE" | "LOCKED";

interface User {
  user_id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
  status: UserStatus;
  last_login_at: string | null;
  created_at: string | null;
}

interface UsersResponse {
  users?: User[];
  message?: string;
}

interface UserForm {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
}

interface UserModalProps {
  title: string;
  subtitle: string;
  form: UserForm;
  setForm: React.Dispatch<React.SetStateAction<UserForm>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  isEdit?: boolean;
}

interface FieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: Array<[string, string]>;
}

interface TableHeadProps {
  children: ReactNode;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
}

interface RoleBadgeProps {
  role: UserRole;
}

interface StatusBadgeProps {
  status: UserStatus;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [selectedUser, setSelectedUser] =
    useState<User | null>(null);

  const [form, setForm] = useState<UserForm>({
    fullName: "",
    email: "",
    password: "",
    role: "USER",
    status: "ACTIVE",
  });

  async function loadUsers(): Promise<void> {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
      });

      const data: UsersResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to load users"
        );
      }

      setUsers(data.users || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load users"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter(
        (user) => user.status === "ACTIVE"
      ).length,
      admins: users.filter(
        (user) => user.role === "ADMIN"
      ).length,
      inactive: users.filter(
        (user) => user.status !== "ACTIVE"
      ).length,
    }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) =>
      [
        user.full_name,
        user.email,
        user.role,
        user.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query)
        )
    );
  }, [users, search]);

  function resetForm(): void {
    setForm({
      fullName: "",
      email: "",
      password: "",
      role: "USER",
      status: "ACTIVE",
    });
  }

  function openCreateModal(): void {
    setError("");
    setSuccess("");
    resetForm();
    setShowCreate(true);
  }

  function openEditModal(user: User): void {
    setError("");
    setSuccess("");
    setSelectedUser(user);

    setForm({
      fullName: user.full_name || "",
      email: user.email || "",
      password: "",
      role: user.role || "USER",
      status: user.status || "ACTIVE",
    });

    setShowEdit(true);
  }

  function closeModals(): void {
    if (saving) {
      return;
    }

    setShowCreate(false);
    setShowEdit(false);
    setSelectedUser(null);
    resetForm();
  }

  async function handleCreate(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (!form.password) {
      setError("Password is required.");
      return;
    }

    if (form.password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        "/api/admin/users",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            password: form.password,
            role: form.role,
            status: form.status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to create user"
        );
      }

      setShowCreate(false);
      resetForm();

      setSuccess("User created successfully.");

      await loadUsers();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create user"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    if (!selectedUser) {
      return;
    }

    setError("");
    setSuccess("");

    if (!form.email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (
      form.password &&
      form.password.length < 8
    ) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `/api/admin/users/${selectedUser.user_id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            role: form.role,
            status: form.status,
            ...(form.password
              ? { password: form.password }
              : {}),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to update user"
        );
      }

      setShowEdit(false);
      setSelectedUser(null);
      resetForm();

      setSuccess("User updated successfully.");

      await loadUsers();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update user"
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(
    user: User,
    status: UserStatus
  ): Promise<void> {
    setError("");
    setSuccess("");

    const action =
      status === "ACTIVE"
        ? "activate"
        : status === "LOCKED"
          ? "lock"
          : "deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${user.email}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `/api/admin/users/${user.user_id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to ${action} user`
        );
      }

      setSuccess(
        `User ${action}d successfully.`
      );

      await loadUsers();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${action} user`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Administration
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            User Management
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Manage application users and administrator accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <span className="mr-1.5 text-base leading-none">
            +
          </span>
          Create User
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700">
          {success}
        </div>
      )}

      {/* Stats */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Users"
          value={stats.total}
          icon="U"
        />

        <StatCard
          label="Active Users"
          value={stats.active}
          icon="✓"
        />

        <StatCard
          label="Administrators"
          value={stats.admins}
          icon="A"
        />

        <StatCard
          label="Inactive / Locked"
          value={stats.inactive}
          icon="!"
        />
      </div>

      {/* Users Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Application Users
            </h3>

            <p className="mt-0.5 text-[11px] text-slate-500">
              {filteredUsers.length} of{" "}
              {users.length} users shown
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={(
              event: ChangeEvent<HTMLInputElement>
            ) => setSearch(event.target.value)}
            placeholder="Search users..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 md:w-64"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center"
                  >
                    <div className="flex flex-col items-center">
                      <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

                      <p className="mt-3 text-xs text-slate-500">
                        Loading users...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-xs text-slate-500"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.user_id}
                    className="transition hover:bg-slate-50"
                  >
                    {/* User */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                          {(
                            user.full_name ||
                            user.email ||
                            "U"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className="max-w-[180px] truncate text-xs font-semibold text-slate-900">
                            {user.full_name ||
                              "Unnamed User"}
                          </p>

                          <p className="max-w-[200px] truncate text-[10px] text-slate-500">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3.5">
                      <RoleBadge role={user.role} />
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={user.status} />
                    </td>

                    {/* Last Login */}
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-600">
                      {formatDate(user.last_login_at)}
                    </td>

                    {/* Created */}
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-600">
                      {formatDate(user.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            openEditModal(user)
                          }
                          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Edit
                        </button>

                        {user.status === "ACTIVE" ? (
                          <>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                updateStatus(
                                  user,
                                  "INACTIVE"
                                )
                              }
                              className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                            >
                              Deactivate
                            </button>

                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                updateStatus(
                                  user,
                                  "LOCKED"
                                )
                              }
                              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                            >
                              Lock
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              updateStatus(
                                user,
                                "ACTIVE"
                              )
                            }
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create Modal */}
      {showCreate && (
        <UserModal
          title="Create New User"
          subtitle="Create credentials for an authorized user."
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={closeModals}
          onSubmit={handleCreate}
          submitLabel="Create User"
        />
      )}

      {/* Edit Modal */}
      {showEdit && selectedUser && (
        <UserModal
          title="Edit User"
          subtitle={`Manage ${selectedUser.email}`}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={closeModals}
          onSubmit={handleUpdate}
          submitLabel="Save Changes"
          isEdit
        />
      )}
    </div>
  );
}

function UserModal({
  title,
  subtitle,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
  submitLabel,
  isEdit = false,
}: UserModalProps) {
  function update(
    field: keyof UserForm,
    value: string
  ): void {
    setForm((current) => ({
      ...current,
      [field]:
        field === "role"
          ? (value as UserRole)
          : field === "status"
            ? (value as UserStatus)
            : value,
    }));
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 px-4 py-5 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              User Administration
            </p>

            <h3 className="mt-1 text-base font-semibold text-slate-900">
              {title}
            </h3>

            <p className="mt-0.5 text-xs text-slate-500">
              {subtitle}
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="text-xl leading-none text-slate-400 hover:text-slate-700 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={onSubmit}
          className="space-y-4 px-5 py-5"
        >
          <Field
            label="Full Name"
            value={form.fullName}
            onChange={(value) =>
              update("fullName", value)
            }
            placeholder="Enter full name"
            disabled={saving}
          />

          <Field
            label="Email Address"
            type="email"
            value={form.email}
            onChange={(value) =>
              update("email", value)
            }
            placeholder="user@company.com"
            disabled={saving}
            required
          />

          <Field
            label={
              isEdit
                ? "New Password (optional)"
                : "Temporary Password"
            }
            type="password"
            value={form.password}
            onChange={(value) =>
              update("password", value)
            }
            placeholder={
              isEdit
                ? "Leave blank to keep current password"
                : "Minimum 8 characters"
            }
            disabled={saving}
            required={!isEdit}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Role"
              value={form.role}
              onChange={(value) =>
                update("role", value)
              }
              disabled={saving}
              options={[
                ["USER", "USER"],
                ["ADMIN", "ADMIN"],
              ]}
            />

            <SelectField
              label="Status"
              value={form.status}
              onChange={(value) =>
                update("status", value)
              }
              disabled={saving}
              options={[
                ["ACTIVE", "ACTIVE"],
                ["INACTIVE", "INACTIVE"],
                ["LOCKED", "LOCKED"],
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  required,
}: FieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-700">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(
          event: ChangeEvent<HTMLInputElement>
        ) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-xs outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  disabled,
  options,
}: SelectFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-700">
        {label}
      </label>

      <select
        value={value}
        onChange={(
          event: ChangeEvent<HTMLSelectElement>
        ) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        {options.map(
          ([optionValue, optionLabel]) => (
            <option
              key={optionValue}
              value={optionValue}
            >
              {optionLabel}
            </option>
          )
        )}
      </select>
    </div>
  );
}

function TableHead({
  children,
}: TableHeadProps) {
  return (
    <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
      {children}
    </th>
  );
}

function StatCard({
  label,
  value,
  icon,
}: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">
          {label}
        </p>

        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-700">
          {icon}
        </div>
      </div>

      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

function RoleBadge({
  role,
}: RoleBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
        role === "ADMIN"
          ? "bg-violet-100 text-violet-700"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {role}
    </span>
  );
}

function StatusBadge({
  status,
}: StatusBadgeProps) {
  const styles: Record<UserStatus, string> = {
    ACTIVE:
      "bg-emerald-100 text-emerald-700",
    INACTIVE:
      "bg-amber-100 text-amber-700",
    LOCKED:
      "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
        styles[status] ||
        "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}

function formatDate(
  value: string | null | undefined
): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}