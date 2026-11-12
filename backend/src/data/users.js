import bcrypt from "bcrypt";

// default admin
export const users = [
  {
    id: "1",
    name: "Developer Admin",
    email: "admin@oep.com",
    passwordHash: await bcrypt.hash("admin123", 10),
    role: "admin",
  },
];
