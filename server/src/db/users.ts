import { randomUUID } from "crypto";
import { ModifiedWebSocket, User } from "../types";

interface UsersStorage {
  users: User[];
  addUser(userName: string, password: string, ws: ModifiedWebSocket): string;
  findUser(index: string): User | undefined;
}

export const usersStorage: UsersStorage = {
  users: [],
  addUser(userName: string, password: string, ws: ModifiedWebSocket) {
    const id = randomUUID();
    this.users.push({ name: userName, password: password, index: id, ws: ws });
    return id;
  },
  findUser(index: string) {
    return this.users.find((user) => user.index === index);
  },
};
