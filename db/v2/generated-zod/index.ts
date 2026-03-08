import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import {
  credentialTypes,
  projectRoles,
  projects,
  projectsTeams,
  projectsUsers,
  systemRoles,
  teamRoles,
  teams,
  teamsUsers,
  users,
  usersCredentialTypes,
  usersPasswordCredentials,
  usersProjectsProjectRoles,
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

export const systemRolesInsertSchema = createInsertSchema(systemRoles);
export const systemRolesSelectSchema = createSelectSchema(systemRoles);

export const projectRolesInsertSchema = createInsertSchema(projectRoles);
export const projectRolesSelectSchema = createSelectSchema(projectRoles);

export const teamRolesInsertSchema = createInsertSchema(teamRoles);
export const teamRolesSelectSchema = createSelectSchema(teamRoles);

export const credentialTypesInsertSchema = createInsertSchema(credentialTypes);
export const credentialTypesSelectSchema = createSelectSchema(credentialTypes);

export const projectsUsersInsertSchema = createInsertSchema(projectsUsers);
export const projectsUsersSelectSchema = createSelectSchema(projectsUsers);

export const teamsUsersInsertSchema = createInsertSchema(teamsUsers);
export const teamsUsersSelectSchema = createSelectSchema(teamsUsers);

export const projectsTeamsInsertSchema = createInsertSchema(projectsTeams);
export const projectsTeamsSelectSchema = createSelectSchema(projectsTeams);

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
