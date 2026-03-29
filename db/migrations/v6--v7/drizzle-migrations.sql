ALTER TABLE `Projects` RENAME COLUMN `journal` TO `reusable-v7-projects-journal`;
--> statement-breakpoint
ALTER TABLE `Issues` RENAME COLUMN `journal` TO `reusable-v7-issues-journal`;
--> statement-breakpoint
CREATE TABLE `Projects_Attachments` (
	`projectId` integer NOT NULL,
	`attachmentId` text NOT NULL,
	PRIMARY KEY(`projectId`, `attachmentId`),
	FOREIGN KEY (`projectId`) REFERENCES `Projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`attachmentId`) REFERENCES `Attachments`(`id`) ON UPDATE cascade ON DELETE cascade
);
