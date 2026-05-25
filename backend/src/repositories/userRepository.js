import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuid } from 'uuid';

export class UserRepository {
  constructor({ dataDir, admin }) {
    this.filePath = path.join(dataDir, 'users.runtime.json');
    this.admin = admin;
    this.users = [];
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      this.users = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      await this.#ensureAdminUser();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.users = [
        await this.#newAdminUser()
      ];
      await this.#persist();
    }
  }

  findByEmail(email) {
    return this.users.find((user) => user.email === String(email || '').toLowerCase());
  }

  async #persist() {
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.users, null, 2));
    await fs.rename(tempPath, this.filePath);
  }

  async #ensureAdminUser() {
    const email = this.admin.email.toLowerCase();
    const admin = this.users.find((user) => user.email === email);
    if (!admin) {
      this.users.unshift(await this.#newAdminUser());
      await this.#persist();
      return;
    }

    if (!String(admin.passwordHash || '').startsWith('$2')) {
      admin.passwordHash = await bcrypt.hash(this.admin.password, 12);
      admin.role = admin.role || 'admin';
      admin.name = admin.name || 'Catalog Admin';
      await this.#persist();
    }
  }

  async #newAdminUser() {
    return {
      id: uuid(),
      email: this.admin.email.toLowerCase(),
      name: 'Catalog Admin',
      role: 'admin',
      passwordHash: await bcrypt.hash(this.admin.password, 12),
      createdAt: new Date().toISOString()
    };
  }
}
