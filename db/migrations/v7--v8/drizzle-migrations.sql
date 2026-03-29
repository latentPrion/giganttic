CREATE TABLE `Notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventType` text NOT NULL,
	`actorUserId` integer NOT NULL,
	`projectId` integer NOT NULL,
	`issueId` integer,
	`taskId` text,
	`commentId` integer,
	`attachmentId` text,
	`message` text NOT NULL,
	`targetUrl` text NOT NULL,
	`createdAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updatedAt` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`actorUserId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`projectId`) REFERENCES `Projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`issueId`) REFERENCES `Issues`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`attachmentId`) REFERENCES `Attachments`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Notifications_eventType_createdAt_idx` ON `Notifications` (`eventType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `Notifications_projectId_createdAt_idx` ON `Notifications` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `Users_Notifications` (
	`userId` integer NOT NULL,
	`notificationId` integer NOT NULL,
	`hasBeenNoticed` integer DEFAULT false NOT NULL,
	`noticedTimestamp` integer,
	PRIMARY KEY(`userId`, `notificationId`),
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`notificationId`) REFERENCES `Notifications`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Users_Notifications_userId_hasBeenNoticed_notificationId_idx` ON `Users_Notifications` (`userId`,`hasBeenNoticed`,`notificationId`);--> statement-breakpoint
CREATE INDEX `Users_Notifications_notificationId_idx` ON `Users_Notifications` (`notificationId`);