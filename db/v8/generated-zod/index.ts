import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import {
  attachments,
  closedReasons,
  credentialTypes,
  issueComments,
  issueCommentsAttachments,
  issueStatuses,
  issues,
  issuesAttachments,
  managedTestDataRecords,
  notifications,
  organizationRoles,
  organizations,
  organizationsTeams,
  projectRoles,
  projectsAttachments,
  projects,
  projectsOrganizations,
  projectsTeams,
  projectsUsers,
  scopedAccessObjectTypes,
  scopedAccessTokenCredentialsObjects,
  systemRoles,
  taskAttachments,
  taskComments,
  taskCommentsAttachments,
  taskMirror,
  teamRoles,
  teams,
  teamsUsers,
  users,
  usersCredentialTypes,
  usersNotifications,
  usersOrganizations,
  usersOrganizationsOrganizationRoles,
  usersPasswordCredentials,
  usersProjectsProjectRoles,
  usersScopedAccessTokenCredentials,
  usersSessions,
  usersSystemRoles,
  usersTeamsTeamRoles,
} from "../schema.js";

export const usersInsertSchema = createInsertSchema(users);
export const usersSelectSchema = createSelectSchema(users);

export const projectsInsertSchema = createInsertSchema(projects);
export const projectsSelectSchema = createSelectSchema(projects);

export const teamsInsertSchema = createInsertSchema(teams);
export const teamsSelectSchema = createSelectSchema(teams);

export const organizationsInsertSchema = createInsertSchema(organizations);
export const organizationsSelectSchema = createSelectSchema(organizations);

export const issuesInsertSchema = createInsertSchema(issues);
export const issuesSelectSchema = createSelectSchema(issues);

export const attachmentsInsertSchema = createInsertSchema(attachments);
export const attachmentsSelectSchema = createSelectSchema(attachments);

export const issuesAttachmentsInsertSchema = createInsertSchema(issuesAttachments);
export const issuesAttachmentsSelectSchema = createSelectSchema(issuesAttachments);

export const projectsAttachmentsInsertSchema =
  createInsertSchema(projectsAttachments);
export const projectsAttachmentsSelectSchema =
  createSelectSchema(projectsAttachments);

export const issueCommentsInsertSchema = createInsertSchema(issueComments);
export const issueCommentsSelectSchema = createSelectSchema(issueComments);

export const issueCommentsAttachmentsInsertSchema =
  createInsertSchema(issueCommentsAttachments);
export const issueCommentsAttachmentsSelectSchema =
  createSelectSchema(issueCommentsAttachments);

export const taskMirrorInsertSchema = createInsertSchema(taskMirror);
export const taskMirrorSelectSchema = createSelectSchema(taskMirror);

export const taskAttachmentsInsertSchema = createInsertSchema(taskAttachments);
export const taskAttachmentsSelectSchema = createSelectSchema(taskAttachments);

export const taskCommentsInsertSchema = createInsertSchema(taskComments);
export const taskCommentsSelectSchema = createSelectSchema(taskComments);

export const taskCommentsAttachmentsInsertSchema =
  createInsertSchema(taskCommentsAttachments);
export const taskCommentsAttachmentsSelectSchema =
  createSelectSchema(taskCommentsAttachments);

export const notificationsInsertSchema = createInsertSchema(notifications);
export const notificationsSelectSchema = createSelectSchema(notifications);

export const usersNotificationsInsertSchema =
  createInsertSchema(usersNotifications);
export const usersNotificationsSelectSchema =
  createSelectSchema(usersNotifications);

export const managedTestDataRecordsInsertSchema =
  createInsertSchema(managedTestDataRecords);
export const managedTestDataRecordsSelectSchema =
  createSelectSchema(managedTestDataRecords);

export const systemRolesInsertSchema = createInsertSchema(systemRoles);
export const systemRolesSelectSchema = createSelectSchema(systemRoles);

export const projectRolesInsertSchema = createInsertSchema(projectRoles);
export const projectRolesSelectSchema = createSelectSchema(projectRoles);

export const teamRolesInsertSchema = createInsertSchema(teamRoles);
export const teamRolesSelectSchema = createSelectSchema(teamRoles);

export const organizationRolesInsertSchema =
  createInsertSchema(organizationRoles);
export const organizationRolesSelectSchema =
  createSelectSchema(organizationRoles);

export const issueStatusesInsertSchema = createInsertSchema(issueStatuses);
export const issueStatusesSelectSchema = createSelectSchema(issueStatuses);

export const closedReasonsInsertSchema = createInsertSchema(closedReasons);
export const closedReasonsSelectSchema = createSelectSchema(closedReasons);

export const credentialTypesInsertSchema = createInsertSchema(credentialTypes);
export const credentialTypesSelectSchema = createSelectSchema(credentialTypes);

export const projectsUsersInsertSchema = createInsertSchema(projectsUsers);
export const projectsUsersSelectSchema = createSelectSchema(projectsUsers);

export const teamsUsersInsertSchema = createInsertSchema(teamsUsers);
export const teamsUsersSelectSchema = createSelectSchema(teamsUsers);

export const projectsTeamsInsertSchema = createInsertSchema(projectsTeams);
export const projectsTeamsSelectSchema = createSelectSchema(projectsTeams);

export const usersOrganizationsInsertSchema =
  createInsertSchema(usersOrganizations);
export const usersOrganizationsSelectSchema =
  createSelectSchema(usersOrganizations);

export const projectsOrganizationsInsertSchema =
  createInsertSchema(projectsOrganizations);
export const projectsOrganizationsSelectSchema =
  createSelectSchema(projectsOrganizations);

export const organizationsTeamsInsertSchema =
  createInsertSchema(organizationsTeams);
export const organizationsTeamsSelectSchema =
  createSelectSchema(organizationsTeams);

export const usersSystemRolesInsertSchema =
  createInsertSchema(usersSystemRoles);
export const usersSystemRolesSelectSchema =
  createSelectSchema(usersSystemRoles);

export const usersProjectsProjectRolesInsertSchema =
  createInsertSchema(usersProjectsProjectRoles);
export const usersProjectsProjectRolesSelectSchema =
  createSelectSchema(usersProjectsProjectRoles);

export const usersTeamsTeamRolesInsertSchema =
  createInsertSchema(usersTeamsTeamRoles);
export const usersTeamsTeamRolesSelectSchema =
  createSelectSchema(usersTeamsTeamRoles);

export const usersOrganizationsOrganizationRolesInsertSchema =
  createInsertSchema(usersOrganizationsOrganizationRoles);
export const usersOrganizationsOrganizationRolesSelectSchema =
  createSelectSchema(usersOrganizationsOrganizationRoles);

export const usersCredentialTypesInsertSchema =
  createInsertSchema(usersCredentialTypes);
export const usersCredentialTypesSelectSchema =
  createSelectSchema(usersCredentialTypes);

export const usersPasswordCredentialsInsertSchema =
  createInsertSchema(usersPasswordCredentials);
export const usersPasswordCredentialsSelectSchema =
  createSelectSchema(usersPasswordCredentials);

export const usersSessionsInsertSchema = createInsertSchema(usersSessions);
export const usersSessionsSelectSchema = createSelectSchema(usersSessions);

export const scopedAccessObjectTypesInsertSchema =
  createInsertSchema(scopedAccessObjectTypes);
export const scopedAccessObjectTypesSelectSchema =
  createSelectSchema(scopedAccessObjectTypes);

export const usersScopedAccessTokenCredentialsInsertSchema =
  createInsertSchema(usersScopedAccessTokenCredentials);
export const usersScopedAccessTokenCredentialsSelectSchema =
  createSelectSchema(usersScopedAccessTokenCredentials);

export const scopedAccessTokenCredentialsObjectsInsertSchema =
  createInsertSchema(scopedAccessTokenCredentialsObjects);
export const scopedAccessTokenCredentialsObjectsSelectSchema =
  createSelectSchema(scopedAccessTokenCredentialsObjects);
