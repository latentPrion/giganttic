CREATE TABLE `Mentions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`speakerUserId` integer NOT NULL,
	`mentionedUserId` integer NOT NULL,
	`projectId` integer NOT NULL,
	`issueId` integer,
	`taskId` text,
	`commentId` integer,
	`mentionContainerType` text NOT NULL,
	`containerKey` text NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`speakerUserId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`mentionedUserId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`projectId`) REFERENCES `Projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`issueId`) REFERENCES `Issues`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Mentions_mentionedUserId_mentionContainerType_containerKey_unique` ON `Mentions` (`mentionedUserId`,`mentionContainerType`,`containerKey`);--> statement-breakpoint
CREATE INDEX `Mentions_containerKey_idx` ON `Mentions` (`containerKey`);--> statement-breakpoint
CREATE INDEX `Mentions_projectId_issueId_taskId_commentId_idx` ON `Mentions` (`projectId`,`issueId`,`taskId`,`commentId`);--> statement-breakpoint
CREATE INDEX `Mentions_mentionedUserId_idx` ON `Mentions` (`mentionedUserId`);--> statement-breakpoint
ALTER TABLE `Notifications` ADD `mentionedUserId` integer REFERENCES Users(id);--> statement-breakpoint
CREATE INDEX `Notifications_commentId_mentionedUserId_idx` ON `Notifications` (`commentId`,`mentionedUserId`);