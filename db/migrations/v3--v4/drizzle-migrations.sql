CREATE TABLE `ScopedAccessObjectTypes` (
	`code` text PRIMARY KEY NOT NULL,
	`displayName` text NOT NULL,
	`description` text,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ScopedAccessTokenCredentials_Objects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scopedAccessTokenCredentialId` integer NOT NULL,
	`scopedAccessObjectTypeCode` text NOT NULL,
	`scopedAccessObjectId` integer NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`scopedAccessTokenCredentialId`) REFERENCES `Users_ScopedAccessTokenCredentials`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`scopedAccessObjectTypeCode`) REFERENCES `ScopedAccessObjectTypes`(`code`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ScopedAccessTokenCredentials_Objects_tokenCredentialId_objectTypeCode_objectId_unique` ON `ScopedAccessTokenCredentials_Objects` (`scopedAccessTokenCredentialId`,`scopedAccessObjectTypeCode`,`scopedAccessObjectId`);--> statement-breakpoint
CREATE TABLE `Users_ScopedAccessTokenCredentials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ownerUserId` integer NOT NULL,
	`userCredentialTypeId` integer NOT NULL,
	`tokenHash` text NOT NULL,
	`expiresAt` integer,
	`revokedAt` integer,
	`lastUsedAt` integer,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`ownerUserId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userCredentialTypeId`) REFERENCES `Users_CredentialTypes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_ScopedAccessTokenCredentials_tokenHash_unique` ON `Users_ScopedAccessTokenCredentials` (`tokenHash`);--> statement-breakpoint
CREATE UNIQUE INDEX `Users_ScopedAccessTokenCredentials_userCredentialTypeId_unique` ON `Users_ScopedAccessTokenCredentials` (`userCredentialTypeId`);
--> statement-breakpoint
ALTER TABLE `Users_Sessions` ADD `authSourceCredentialTypeCode` text;
--> statement-breakpoint
ALTER TABLE `Users_Sessions` ADD `authSourceCredentialId` integer;