CREATE TABLE `Attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`originalFilename` text NOT NULL,
	`byteLength` integer NOT NULL,
	`contentHash` text NOT NULL,
	`uploadedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`uploadedByUserId` integer NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`uploadedByUserId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `IssueComments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issueId` integer NOT NULL,
	`createdByUserId` integer NOT NULL,
	`parentCommentId` integer,
	`thumbsUpCount` integer DEFAULT 0 NOT NULL,
	`thumbsDownCount` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`issueId`) REFERENCES `Issues`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`createdByUserId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `IssueComments_Attachments` (
	`issueId` integer NOT NULL,
	`commentId` integer NOT NULL,
	`attachmentId` text NOT NULL,
	PRIMARY KEY(`issueId`, `commentId`, `attachmentId`),
	FOREIGN KEY (`issueId`) REFERENCES `Issues`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`commentId`) REFERENCES `IssueComments`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`attachmentId`) REFERENCES `Attachments`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Issues_Attachments` (
	`issueId` integer NOT NULL,
	`attachmentId` text NOT NULL,
	PRIMARY KEY(`issueId`, `attachmentId`),
	FOREIGN KEY (`issueId`) REFERENCES `Issues`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`attachmentId`) REFERENCES `Attachments`(`id`) ON UPDATE cascade ON DELETE cascade
);
