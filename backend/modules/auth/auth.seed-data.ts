export const seededTestAccounts = {
  admin: {
    email: "testadminuser@gigantt.com",
    passwordHash:
      "$argon2id$v=19$m=65536,t=3,p=4$dGVzdGFkbWludXNlci1zZWVk$P9p0LD9Hk170tBlwVh+aHKH628YCc97Ay7wSKYog0mU",
    plaintextPassword: "1234",
    username: "testadminuser",
  },
  noRole: {
    email: "testnoroleuser@gigantt.com",
    passwordHash:
      "$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE",
    plaintextPassword: "1234",
    username: "testnoroleuser",
  },
} as const;
