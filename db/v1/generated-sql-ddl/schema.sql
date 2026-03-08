CREATE TABLE `CredentialTypes` (
	`code` text PRIMARY KEY NOT NULL,
	`displayName` text NOT NULL,
	`description` text,
	`allowsMultiplePerUser` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Roles` (
	`code` text PRIMARY KEY NOT NULL,
	`displayName` text NOT NULL,
	`description` text,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`deactivatedAt` integer,
	`deletedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_username_unique` ON `Users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `Users_email_unique` ON `Users` (`email`);--> statement-breakpoint
CREATE TABLE `Users_CredentialTypes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`credentialTypeCode` text NOT NULL,
	`credentialLabel` text,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`revokedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`credentialTypeCode`) REFERENCES `CredentialTypes`(`code`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_CredentialTypes_password_singleton_unique` ON `Users_CredentialTypes` (`userId`) WHERE "Users_CredentialTypes"."credentialTypeCode" = 'GGTC_CREDTYPE_USERNAME_PASSWORD';--> statement-breakpoint
CREATE TABLE `Users_PasswordCredentials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userCredentialTypeId` integer NOT NULL,
	`passwordHash` text NOT NULL,
	`passwordAlgorithm` text DEFAULT 'argon2id' NOT NULL,
	`passwordVersion` integer DEFAULT 1 NOT NULL,
	`passwordUpdatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`userCredentialTypeId`) REFERENCES `Users_CredentialTypes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_PasswordCredentials_userCredentialTypeId_unique` ON `Users_PasswordCredentials` (`userCredentialTypeId`);--> statement-breakpoint
CREATE TABLE `Users_Roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`roleCode` text NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`roleCode`) REFERENCES `Roles`(`code`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_Roles_userId_roleCode_unique` ON `Users_Roles` (`userId`,`roleCode`);--> statement-breakpoint
CREATE TABLE `Users_Sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`sessionTokenHash` text NOT NULL,
	`startTimestamp` integer NOT NULL,
	`expirationTimestamp` integer NOT NULL,
	`ipAddress` text NOT NULL,
	`location` text,
	`oauthAuthorizationCode` text,
	`oauthAccessToken` text,
	`oauthRefreshToken` text,
	`revokedAt` integer,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "Users_Sessions_expirationTimestamp_after_startTimestamp_check" CHECK("Users_Sessions"."expirationTimestamp" > "Users_Sessions"."startTimestamp")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_Sessions_sessionTokenHash_unique` ON `Users_Sessions` (`sessionTokenHash`);