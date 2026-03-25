import { randomUUID } from "crypto";
import { User } from "../types";

interface UsersStorage {
  users: User[];
  addUser(userName: string, password: string): string;
}

export const usersStorage: UsersStorage = {
  users: [],
  addUser(userName: string, password: string) {
    const id = randomUUID();
    this.users.push({ name: userName, password: password, index: id });
    return id;
  },
};
