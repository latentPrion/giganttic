CREATE TABLE `TaskAttachments` (
	`projectId` integer NOT NULL,
	`taskId` text NOT NULL,
	`attachmentId` text NOT NULL,
	PRIMARY KEY(`projectId`, `taskId`, `attachmentId`),
	FOREIGN KEY (`projectId`) REFERENCES `Projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`attachmentId`) REFERENCES `Attachments`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`projectId`,`taskId`) REFERENCES `TaskMirror`(`projectId`,`taskId`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `TaskComments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`projectId` integer NOT NULL,
	`taskId` text NOT NULL,
	`createdByUserId` integer NOT NULL,
	`parentCommentId` integer,
	`thumbsUpCount` integer DEFAULT 0 NOT NULL,
	`thumbsDownCount` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`createdByUserId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`projectId`,`taskId`) REFERENCES `TaskMirror`(`projectId`,`taskId`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `TaskComments_Attachments` (
	`projectId` integer NOT NULL,
	`taskId` text NOT NULL,
	`commentId` integer NOT NULL,
	`attachmentId` text NOT NULL,
	PRIMARY KEY(`projectId`, `taskId`, `commentId`, `attachmentId`),
	FOREIGN KEY (`projectId`) REFERENCES `Projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`commentId`) REFERENCES `TaskComments`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`attachmentId`) REFERENCES `Attachments`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`projectId`,`taskId`) REFERENCES `TaskMirror`(`projectId`,`taskId`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `TaskMirror` (
	`projectId` integer NOT NULL,
	`taskId` text NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	PRIMARY KEY(`projectId`, `taskId`),
	FOREIGN KEY (`projectId`) REFERENCES `Projects`(`id`) ON UPDATE cascade ON DELETE cascade
);
