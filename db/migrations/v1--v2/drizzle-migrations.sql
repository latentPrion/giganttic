ALTER TABLE `Roles` RENAME TO `__legacy_Roles`;--> statement-breakpoint
ALTER TABLE `Users_Roles` RENAME TO `__legacy_Users_Roles`;--> statement-breakpoint
CREATE TABLE `ClosedReasons` (
	`code` text PRIMARY KEY NOT NULL,
	`displayName` text NOT NULL,
	`description` text,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `IssueStatuses` (
	`code` text PRIMARY KEY NOT NULL,
	`displayName` text NOT NULL,
	`description` text,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`projectId` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`journal` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ISSUE_STATUS_OPEN' NOT NULL,
	`closedReason` text,
	`progressPercentage` integer DEFAULT 0 NOT NULL,
	`openedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`closedAt` integer,
	`closedReasonDescription` text,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`status`) REFERENCES `IssueStatuses`(`code`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`closedReason`) REFERENCES `ClosedReasons`(`code`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "Issues_priority_non_negative_check" CHECK("Issues"."priority" >= 0),
	CONSTRAINT "Issues_progressPercentage_range_check" CHECK("Issues"."progressPercentage" >= 0 AND "Issues"."progressPercentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE `ManagedTestDataRecords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seedKey` text NOT NULL,
	`entityTable` text NOT NULL,
	`entityId` integer NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ManagedTestDataRecords_seedKey_unique` ON `ManagedTestDataRecords` (`seedKey`);--> statement-breakpoint
CREATE UNIQUE INDEX `ManagedTestDataRecords_entityTable_entityId_unique` ON `ManagedTestDataRecords` (`entityTable`,`entityId`);--> statement-breakpoint
CREATE TABLE `Organizations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Organizations_Teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organizationId` integer NOT NULL,
	`teamId` integer NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organizations`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Teams`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Organizations_Teams_organizationId_teamId_unique` ON `Organizations_Teams` (`organizationId`,`teamId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Organizations_Teams_teamId_unique` ON `Organizations_Teams` (`teamId`);--> statement-breakpoint
CREATE TABLE `OrganizationRoles` (
	`code` text PRIMARY KEY NOT NULL,
	`displayName` text NOT NULL,
	`description` text,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ProjectRoles` (
	`code` text PRIMARY KEY NOT NULL,
	`displayName` text NOT NULL,
	`description` text,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`journal` text,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Projects_Organizations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organizationId` integer NOT NULL,
	`projectId` integer NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organizations`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`projectId`) REFERENCES `Projects`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Projects_Organizations_organizationId_projectId_unique` ON `Projects_Organizations` (`organizationId`,`projectId`);--> statement-breakpoint
CREATE TABLE `Projects_Teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`projectId` integer NOT NULL,
	`teamId` integer NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Teams`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Projects_Teams_projectId_teamId_unique` ON `Projects_Teams` (`projectId`,`teamId`);--> statement-breakpoint
CREATE TABLE `Projects_Users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`projectId` integer NOT NULL,
	`userId` integer NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Projects_Users_projectId_userId_unique` ON `Projects_Users` (`projectId`,`userId`);--> statement-breakpoint
CREATE TABLE `TeamRoles` (
	`code` text PRIMARY KEY NOT NULL,
	`displayName` text NOT NULL,
	`description` text,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Teams_Users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`teamId` integer NOT NULL,
	`userId` integer NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `Teams`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Teams_Users_teamId_userId_unique` ON `Teams_Users` (`teamId`,`userId`);--> statement-breakpoint
CREATE TABLE `Users_Organizations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organizationId` integer NOT NULL,
	`userId` integer NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organizations`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_Organizations_organizationId_userId_unique` ON `Users_Organizations` (`organizationId`,`userId`);--> statement-breakpoint
CREATE TABLE `Users_Organizations_OrganizationRoles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`organizationId` integer NOT NULL,
	`roleCode` text NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`organizationId`) REFERENCES `Organizations`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`roleCode`) REFERENCES `OrganizationRoles`(`code`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_Organizations_OrganizationRoles_userId_organizationId_roleCode_unique` ON `Users_Organizations_OrganizationRoles` (`userId`,`organizationId`,`roleCode`);--> statement-breakpoint
CREATE TABLE `Users_Projects_ProjectRoles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`projectId` integer NOT NULL,
	`roleCode` text NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`projectId`) REFERENCES `Projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`roleCode`) REFERENCES `ProjectRoles`(`code`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_Projects_ProjectRoles_userId_projectId_roleCode_unique` ON `Users_Projects_ProjectRoles` (`userId`,`projectId`,`roleCode`);--> statement-breakpoint
CREATE TABLE `Users_SystemRoles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`roleCode` text NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`roleCode`) REFERENCES `SystemRoles`(`code`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_SystemRoles_userId_roleCode_unique` ON `Users_SystemRoles` (`userId`,`roleCode`);--> statement-breakpoint
CREATE TABLE `Users_Teams_TeamRoles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`teamId` integer NOT NULL,
	`roleCode` text NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Teams`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`roleCode`) REFERENCES `TeamRoles`(`code`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_Teams_TeamRoles_userId_teamId_roleCode_unique` ON `Users_Teams_TeamRoles` (`userId`,`teamId`,`roleCode`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_SystemRoles` (
	`code` text PRIMARY KEY NOT NULL,
	`displayName` text NOT NULL,
	`description` text,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_SystemRoles`("code", "displayName", "description", "createdAt")
SELECT
	'GGTC_SYSTEMROLE_ADMIN',
	"displayName",
	"description",
	"createdAt"
FROM `__legacy_Roles`
WHERE `code` = 'GGTC_ROLE_ADMIN';--> statement-breakpoint
ALTER TABLE `__new_SystemRoles` RENAME TO `SystemRoles`;--> statement-breakpoint
INSERT INTO `Users_SystemRoles`("userId", "roleCode", "createdAt")
SELECT
	"userId",
	'GGTC_SYSTEMROLE_ADMIN',
	"createdAt"
FROM `__legacy_Users_Roles`
WHERE `roleCode` = 'GGTC_ROLE_ADMIN';--> statement-breakpoint
DROP TABLE `__legacy_Users_Roles`;--> statement-breakpoint
DROP TABLE `__legacy_Roles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
