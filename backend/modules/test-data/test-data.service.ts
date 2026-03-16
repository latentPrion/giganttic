import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";

import {
  closedReasonCodes,
  credentialTypeCodes,
  issues,
  managedTestDataRecords,
  organizationRoleCodes,
  organizations,
  organizationsTeams,
  projectRoleCodes,
  projects,
  projectsOrganizations,
  projectsTeams,
  projectsUsers,
  teamRoleCodes,
  teams,
  teamsUsers,
  users,
  usersCredentialTypes,
  usersOrganizations,
  usersOrganizationsOrganizationRoles,
  usersPasswordCredentials,
  usersProjectsProjectRoles,
  usersSessions,
  usersSystemRoles,
  usersTeamsTeamRoles,
} from "../../../db/index.js";
import { DatabaseService } from "../database/database.service.js";
import {
  seededScopedFixtures,
  seededTestAccounts,
} from "./test-data.seed-data.js";

type SeedDatabase = DatabaseService["db"];
type SeededAccountKey = keyof typeof seededTestAccounts;
type SeededUserIds = Record<SeededAccountKey, number>;

type NamedSeedEntity = {
  description: string;
  name: string;
  seedKey: string;
};

type SeededIssueEntity =
  (typeof seededScopedFixtures.issues.orgProjectManager)[number];

const TEST_DATA_ENTITY_TABLES = {
  organization: "Organizations",
  project: "Projects",
  team: "Teams",
  user: "Users",
} as const;

@Injectable()
export class TestDataService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async ensureTestData(): Promise<void> {
    this.databaseService.db.transaction((tx) => {
      const seededUserIds = this.ensureSeedUsers(tx);
      this.ensureScopedSeedFixtures(tx, seededUserIds);
    });
  }

  async hasTestData(): Promise<boolean> {
    const record = this.databaseService.db
      .select({ id: managedTestDataRecords.id })
      .from(managedTestDataRecords)
      .get();

    return record !== undefined;
  }

  async purgeTestData(): Promise<void> {
    this.databaseService.db.transaction((tx) => {
      const trackedIds = this.readTrackedEntityIds(tx);
      this.deleteTrackedProjectChildren(tx, trackedIds.projectIds);
      this.deleteTrackedTeamChildren(tx, trackedIds.teamIds);
      this.deleteTrackedOrganizationChildren(tx, trackedIds.organizationIds);
      this.deleteTrackedUserChildren(tx, trackedIds.userIds);
      this.deleteTrackedTopLevelEntities(tx, trackedIds);
      tx.delete(managedTestDataRecords).run();
    });
  }

  private ensureSeedUsers(tx: SeedDatabase): SeededUserIds {
    return {
      admin: this.ensureUser(tx, {
        ...seededTestAccounts.admin,
        systemRoleCode: "GGTC_SYSTEMROLE_ADMIN",
      }),
      noRole: this.ensureUser(tx, {
        ...seededTestAccounts.noRole,
        systemRoleCode: null,
      }),
      orgOrganizationManager: this.ensureUser(tx, {
        ...seededTestAccounts.orgOrganizationManager,
        systemRoleCode: null,
      }),
      orgProjectManager: this.ensureUser(tx, {
        ...seededTestAccounts.orgProjectManager,
        systemRoleCode: null,
      }),
      orgTeamManager: this.ensureUser(tx, {
        ...seededTestAccounts.orgTeamManager,
        systemRoleCode: null,
      }),
      projectProjectManager: this.ensureUser(tx, {
        ...seededTestAccounts.projectProjectManager,
        systemRoleCode: null,
      }),
      teamProjectManager: this.ensureUser(tx, {
        ...seededTestAccounts.teamProjectManager,
        systemRoleCode: null,
      }),
      teamTeamManager: this.ensureUser(tx, {
        ...seededTestAccounts.teamTeamManager,
        systemRoleCode: null,
      }),
    };
  }

  private ensureUser(
    tx: SeedDatabase,
    seed: {
      email: string;
      passwordHash: string;
      seedKey: string;
      systemRoleCode: string | null;
      username: string;
    },
  ): number {
    const existingByTrackedId = this.findTrackedEntityById(
      tx,
      seed.seedKey,
      TEST_DATA_ENTITY_TABLES.user,
      users,
      users.id,
      users.username,
      seed.username,
    );
    const existingUser = existingByTrackedId
      ?? tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, seed.username))
        .get();

    const userId = existingUser
      ? this.updateExistingUser(tx, existingUser.id, seed)
      : this.createSeededUser(tx, seed);

    this.upsertTrackedEntity(
      tx,
      seed.seedKey,
      TEST_DATA_ENTITY_TABLES.user,
      userId,
    );

    return userId;
  }

  private updateExistingUser(
    tx: SeedDatabase,
    userId: number,
    seed: {
      email: string;
      passwordHash: string;
      systemRoleCode: string | null;
      username: string;
    },
  ): number {
    tx.update(users)
      .set({
        email: seed.email,
        isActive: true,
        updatedAt: new Date(),
        username: seed.username,
      })
      .where(eq(users.id, userId))
      .run();

    const passwordCredential = tx
      .select({
        id: usersCredentialTypes.id,
      })
      .from(usersCredentialTypes)
      .where(
        and(
          eq(usersCredentialTypes.userId, userId),
          eq(
            usersCredentialTypes.credentialTypeCode,
            credentialTypeCodes.usernamePassword,
          ),
        ),
      )
      .get() ?? this.createUsernamePasswordCredential(tx, userId);

    const passwordRow = tx
      .select({
        id: usersPasswordCredentials.id,
      })
      .from(usersPasswordCredentials)
      .where(
        eq(
          usersPasswordCredentials.userCredentialTypeId,
          passwordCredential.id,
        ),
      )
      .get();

    if (passwordRow) {
      tx.update(usersPasswordCredentials)
        .set({
          passwordHash: seed.passwordHash,
          passwordUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(usersPasswordCredentials.id, passwordRow.id))
        .run();
    } else {
      tx.insert(usersPasswordCredentials)
        .values({
          passwordHash: seed.passwordHash,
          userCredentialTypeId: passwordCredential.id,
        })
        .run();
    }

    this.reconcileUserSystemRole(tx, userId, seed.systemRoleCode);
    return userId;
  }

  private createSeededUser(
    tx: SeedDatabase,
    seed: {
      email: string;
      passwordHash: string;
      systemRoleCode: string | null;
      username: string;
    },
  ): number {
    const [createdUser] = tx.insert(users)
      .values({
        email: seed.email,
        username: seed.username,
      })
      .returning({ id: users.id })
      .all();

    const credentialInstance = this.createUsernamePasswordCredential(
      tx,
      createdUser.id,
    );

    tx.insert(usersPasswordCredentials)
      .values({
        passwordHash: seed.passwordHash,
        userCredentialTypeId: credentialInstance.id,
      })
      .run();

    this.reconcileUserSystemRole(tx, createdUser.id, seed.systemRoleCode);
    return createdUser.id;
  }

  private createUsernamePasswordCredential(
    tx: SeedDatabase,
    userId: number,
  ) {
    const [createdCredential] = tx
      .insert(usersCredentialTypes)
      .values({
        credentialTypeCode: credentialTypeCodes.usernamePassword,
        userId,
      })
      .returning({ id: usersCredentialTypes.id })
      .all();

    return createdCredential;
  }

  private reconcileUserSystemRole(
    tx: SeedDatabase,
    userId: number,
    systemRoleCode: string | null,
  ): void {
    if (systemRoleCode) {
      tx.insert(usersSystemRoles)
        .values({
          roleCode: systemRoleCode,
          userId,
        })
        .onConflictDoNothing()
        .run();
      return;
    }

    tx.delete(usersSystemRoles)
      .where(eq(usersSystemRoles.userId, userId))
      .run();
  }

  private ensureScopedSeedFixtures(
    tx: SeedDatabase,
    seededUserIds: SeededUserIds,
  ): void {
    const organizationManagerOrganizationId = this.ensureOrganization(
      tx,
      seededScopedFixtures.organizations.orgOrganizationManager,
    );
    const organizationProjectManagerOrganizationId = this.ensureOrganization(
      tx,
      seededScopedFixtures.organizations.orgProjectManager,
    );
    const organizationTeamManagerOrganizationId = this.ensureOrganization(
      tx,
      seededScopedFixtures.organizations.orgTeamManager,
    );
    const directProjectManagerProjectId = this.ensureProject(
      tx,
      seededScopedFixtures.projects.projectProjectManager,
    );
    const organizationProjectManagerProjectId = this.ensureProject(
      tx,
      seededScopedFixtures.projects.orgProjectManager,
    );
    const teamProjectManagerProjectId = this.ensureProject(
      tx,
      seededScopedFixtures.projects.teamProjectManager,
    );
    const directTeamManagerTeamId = this.ensureTeam(
      tx,
      seededScopedFixtures.teams.teamTeamManager,
    );
    const organizationTeamManagerTeamId = this.ensureTeam(
      tx,
      seededScopedFixtures.teams.orgTeamManager,
    );
    const teamProjectManagerTeamId = this.ensureTeam(
      tx,
      seededScopedFixtures.teams.teamProjectManager,
    );

    this.ensureOrganizationMembership(
      tx,
      organizationManagerOrganizationId,
      seededUserIds.orgOrganizationManager,
    );
    this.ensureOrganizationRole(
      tx,
      organizationManagerOrganizationId,
      seededUserIds.orgOrganizationManager,
      organizationRoleCodes.organizationManager,
    );

    this.ensureOrganizationMembership(
      tx,
      organizationProjectManagerOrganizationId,
      seededUserIds.orgProjectManager,
    );
    this.ensureOrganizationRole(
      tx,
      organizationProjectManagerOrganizationId,
      seededUserIds.orgProjectManager,
      organizationRoleCodes.projectManager,
    );
    this.ensureProjectMembership(
      tx,
      organizationProjectManagerProjectId,
      seededUserIds.orgProjectManager,
    );
    this.ensureProjectOrganizationAssociation(
      tx,
      organizationProjectManagerProjectId,
      organizationProjectManagerOrganizationId,
    );

    this.ensureOrganizationMembership(
      tx,
      organizationTeamManagerOrganizationId,
      seededUserIds.orgTeamManager,
    );
    this.ensureOrganizationRole(
      tx,
      organizationTeamManagerOrganizationId,
      seededUserIds.orgTeamManager,
      organizationRoleCodes.teamManager,
    );
    this.ensureTeamMembership(
      tx,
      organizationTeamManagerTeamId,
      seededUserIds.orgTeamManager,
    );
    this.ensureOrganizationTeamAssociation(
      tx,
      organizationTeamManagerTeamId,
      organizationTeamManagerOrganizationId,
    );

    this.ensureTeamMembership(
      tx,
      directTeamManagerTeamId,
      seededUserIds.teamTeamManager,
    );
    this.ensureTeamRole(
      tx,
      directTeamManagerTeamId,
      seededUserIds.teamTeamManager,
      teamRoleCodes.teamManager,
    );

    this.ensureTeamMembership(
      tx,
      teamProjectManagerTeamId,
      seededUserIds.teamProjectManager,
    );
    this.ensureTeamRole(
      tx,
      teamProjectManagerTeamId,
      seededUserIds.teamProjectManager,
      teamRoleCodes.projectManager,
    );
    this.ensureProjectTeamAssociation(
      tx,
      teamProjectManagerProjectId,
      teamProjectManagerTeamId,
    );

    this.ensureProjectMembership(
      tx,
      directProjectManagerProjectId,
      seededUserIds.projectProjectManager,
    );
    this.ensureProjectRole(
      tx,
      directProjectManagerProjectId,
      seededUserIds.projectProjectManager,
      projectRoleCodes.projectManager,
    );

    this.ensureProjectIssues(
      tx,
      organizationProjectManagerProjectId,
      seededScopedFixtures.issues.orgProjectManager,
    );
    this.ensureProjectIssues(
      tx,
      directProjectManagerProjectId,
      seededScopedFixtures.issues.projectProjectManager,
    );
    this.ensureProjectIssues(
      tx,
      teamProjectManagerProjectId,
      seededScopedFixtures.issues.teamProjectManager,
    );
  }

  private ensureOrganization(tx: SeedDatabase, seed: NamedSeedEntity): number {
    const existingByTrackedId = this.findTrackedEntityById(
      tx,
      seed.seedKey,
      TEST_DATA_ENTITY_TABLES.organization,
      organizations,
      organizations.id,
      organizations.name,
      seed.name,
    );
    const existingOrganization = existingByTrackedId
      ?? tx.select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.name, seed.name))
        .get();

    const organizationId = existingOrganization
      ? this.updateNamedEntity(
        tx,
        organizations,
        organizations.id,
        existingOrganization.id,
        seed,
      )
      : this.createNamedEntity(
        tx,
        organizations,
        organizations.id,
        seed,
      );

    this.upsertTrackedEntity(
      tx,
      seed.seedKey,
      TEST_DATA_ENTITY_TABLES.organization,
      organizationId,
    );
    return organizationId;
  }

  private ensureProject(tx: SeedDatabase, seed: NamedSeedEntity): number {
    const existingByTrackedId = this.findTrackedEntityById(
      tx,
      seed.seedKey,
      TEST_DATA_ENTITY_TABLES.project,
      projects,
      projects.id,
      projects.name,
      seed.name,
    );
    const existingProject = existingByTrackedId
      ?? tx.select({ id: projects.id })
        .from(projects)
        .where(eq(projects.name, seed.name))
        .get();

    const projectId = existingProject
      ? this.updateNamedEntity(
        tx,
        projects,
        projects.id,
        existingProject.id,
        seed,
      )
      : this.createNamedEntity(
        tx,
        projects,
        projects.id,
        seed,
      );

    this.upsertTrackedEntity(
      tx,
      seed.seedKey,
      TEST_DATA_ENTITY_TABLES.project,
      projectId,
    );
    return projectId;
  }

  private ensureTeam(tx: SeedDatabase, seed: NamedSeedEntity): number {
    const existingByTrackedId = this.findTrackedEntityById(
      tx,
      seed.seedKey,
      TEST_DATA_ENTITY_TABLES.team,
      teams,
      teams.id,
      teams.name,
      seed.name,
    );
    const existingTeam = existingByTrackedId
      ?? tx.select({ id: teams.id })
        .from(teams)
        .where(eq(teams.name, seed.name))
        .get();

    const teamId = existingTeam
      ? this.updateNamedEntity(tx, teams, teams.id, existingTeam.id, seed)
      : this.createNamedEntity(tx, teams, teams.id, seed);

    this.upsertTrackedEntity(
      tx,
      seed.seedKey,
      TEST_DATA_ENTITY_TABLES.team,
      teamId,
    );
    return teamId;
  }

  private updateNamedEntity(
    tx: SeedDatabase,
    table: typeof organizations | typeof projects | typeof teams,
    idColumn: typeof organizations.id | typeof projects.id | typeof teams.id,
    id: number,
    seed: NamedSeedEntity,
  ): number {
    tx.update(table)
      .set({
        description: seed.description,
        name: seed.name,
        updatedAt: new Date(),
      })
      .where(eq(idColumn, id))
      .run();

    return id;
  }

  private createNamedEntity(
    tx: SeedDatabase,
    table: typeof organizations | typeof projects | typeof teams,
    idColumn: typeof organizations.id | typeof projects.id | typeof teams.id,
    seed: NamedSeedEntity,
  ): number {
    const [createdEntity] = tx.insert(table)
      .values({
        description: seed.description,
        name: seed.name,
      })
      .returning({ id: idColumn })
      .all();

    return createdEntity.id;
  }

  private ensureOrganizationMembership(
    tx: SeedDatabase,
    organizationId: number,
    userId: number,
  ): void {
    tx.insert(usersOrganizations)
      .values({ organizationId, userId })
      .onConflictDoNothing()
      .run();
  }

  private ensureOrganizationRole(
    tx: SeedDatabase,
    organizationId: number,
    userId: number,
    roleCode: string,
  ): void {
    tx.insert(usersOrganizationsOrganizationRoles)
      .values({ organizationId, roleCode, userId })
      .onConflictDoNothing()
      .run();
  }

  private ensureOrganizationTeamAssociation(
    tx: SeedDatabase,
    teamId: number,
    organizationId: number,
  ): void {
    tx.insert(organizationsTeams)
      .values({ organizationId, teamId })
      .onConflictDoNothing()
      .run();
  }

  private ensureProjectMembership(
    tx: SeedDatabase,
    projectId: number,
    userId: number,
  ): void {
    tx.insert(projectsUsers)
      .values({ projectId, userId })
      .onConflictDoNothing()
      .run();
  }

  private ensureProjectOrganizationAssociation(
    tx: SeedDatabase,
    projectId: number,
    organizationId: number,
  ): void {
    tx.insert(projectsOrganizations)
      .values({ organizationId, projectId })
      .onConflictDoNothing()
      .run();
  }

  private ensureProjectRole(
    tx: SeedDatabase,
    projectId: number,
    userId: number,
    roleCode: string,
  ): void {
    tx.insert(usersProjectsProjectRoles)
      .values({ projectId, roleCode, userId })
      .onConflictDoNothing()
      .run();
  }

  private ensureProjectTeamAssociation(
    tx: SeedDatabase,
    projectId: number,
    teamId: number,
  ): void {
    tx.insert(projectsTeams)
      .values({ projectId, teamId })
      .onConflictDoNothing()
      .run();
  }

  private ensureTeamMembership(
    tx: SeedDatabase,
    teamId: number,
    userId: number,
  ): void {
    tx.insert(teamsUsers)
      .values({ teamId, userId })
      .onConflictDoNothing()
      .run();
  }

  private ensureTeamRole(
    tx: SeedDatabase,
    teamId: number,
    userId: number,
    roleCode: string,
  ): void {
    tx.insert(usersTeamsTeamRoles)
      .values({ roleCode, teamId, userId })
      .onConflictDoNothing()
      .run();
  }

  private ensureProjectIssues(
    tx: SeedDatabase,
    projectId: number,
    seededIssues: readonly SeededIssueEntity[],
  ): void {
    for (const seededIssue of seededIssues) {
      const existingIssue = tx
        .select({ id: issues.id })
        .from(issues)
        .where(and(eq(issues.projectId, projectId), eq(issues.name, seededIssue.name)))
        .get();
      const nextValues = this.createSeededIssueValues(projectId, seededIssue);

      if (existingIssue) {
        tx.update(issues)
          .set({
            ...nextValues,
            updatedAt: new Date(),
          })
          .where(eq(issues.id, existingIssue.id))
          .run();
        continue;
      }

      tx.insert(issues).values(nextValues).run();
    }
  }

  private createSeededIssueValues(
    projectId: number,
    seed: SeededIssueEntity,
  ) {
    return {
      closedAt: seed.closedAt ? new Date(seed.closedAt) : null,
      closedReason: seed.closedReason,
      closedReasonDescription: seed.closedReasonDescription,
      description: seed.description,
      journal: seed.journal,
      name: seed.name,
      openedAt: new Date(seed.openedAt),
      priority: seed.priority,
      progressPercentage: seed.progressPercentage,
      projectId,
      status: seed.status,
    };
  }

  private upsertTrackedEntity(
    tx: SeedDatabase,
    seedKey: string,
    entityTable: string,
    entityId: number,
  ): void {
    tx.insert(managedTestDataRecords)
      .values({
        entityId,
        entityTable,
        seedKey,
      })
      .onConflictDoUpdate({
        set: {
          entityId,
          entityTable,
          updatedAt: new Date(),
        },
        target: managedTestDataRecords.seedKey,
      })
      .run();
  }

  private findTrackedEntityById(
    tx: SeedDatabase,
    seedKey: string,
    entityTable: string,
    table:
      | typeof organizations
      | typeof projects
      | typeof teams
      | typeof users,
    idColumn:
      | typeof organizations.id
      | typeof projects.id
      | typeof teams.id
      | typeof users.id,
    fallbackColumn:
      | typeof organizations.name
      | typeof projects.name
      | typeof teams.name
      | typeof users.username,
    fallbackValue: string,
  ): { id: number } | undefined {
    const trackedRecord = tx
      .select({ entityId: managedTestDataRecords.entityId })
      .from(managedTestDataRecords)
      .where(
        and(
          eq(managedTestDataRecords.seedKey, seedKey),
          eq(managedTestDataRecords.entityTable, entityTable),
        ),
      )
      .get();

    if (!trackedRecord) {
      return undefined;
    }

    const entity = tx
      .select({ id: idColumn })
      .from(table)
      .where(eq(idColumn, trackedRecord.entityId))
      .get();

    if (entity) {
      return entity;
    }

    tx.delete(managedTestDataRecords)
      .where(eq(managedTestDataRecords.seedKey, seedKey))
      .run();

    return tx
      .select({ id: idColumn })
      .from(table)
      .where(eq(fallbackColumn, fallbackValue))
      .get();
  }

  private readTrackedEntityIds(tx: SeedDatabase) {
    const rows = tx.select({
      entityId: managedTestDataRecords.entityId,
      entityTable: managedTestDataRecords.entityTable,
    })
      .from(managedTestDataRecords)
      .all();

    return {
      organizationIds: rows
        .filter((row) => row.entityTable === TEST_DATA_ENTITY_TABLES.organization)
        .map((row) => row.entityId),
      projectIds: rows
        .filter((row) => row.entityTable === TEST_DATA_ENTITY_TABLES.project)
        .map((row) => row.entityId),
      teamIds: rows
        .filter((row) => row.entityTable === TEST_DATA_ENTITY_TABLES.team)
        .map((row) => row.entityId),
      userIds: rows
        .filter((row) => row.entityTable === TEST_DATA_ENTITY_TABLES.user)
        .map((row) => row.entityId),
    };
  }

  private deleteTrackedProjectChildren(
    tx: SeedDatabase,
    projectIds: readonly number[],
  ): void {
    if (projectIds.length === 0) {
      return;
    }

    tx.delete(issues).where(inArray(issues.projectId, projectIds)).run();
    tx.delete(projectsOrganizations)
      .where(inArray(projectsOrganizations.projectId, projectIds))
      .run();
    tx.delete(projectsTeams)
      .where(inArray(projectsTeams.projectId, projectIds))
      .run();
    tx.delete(projectsUsers)
      .where(inArray(projectsUsers.projectId, projectIds))
      .run();
    tx.delete(usersProjectsProjectRoles)
      .where(inArray(usersProjectsProjectRoles.projectId, projectIds))
      .run();
  }

  private deleteTrackedTeamChildren(
    tx: SeedDatabase,
    teamIds: readonly number[],
  ): void {
    if (teamIds.length === 0) {
      return;
    }

    tx.delete(projectsTeams).where(inArray(projectsTeams.teamId, teamIds)).run();
    tx.delete(organizationsTeams)
      .where(inArray(organizationsTeams.teamId, teamIds))
      .run();
    tx.delete(teamsUsers).where(inArray(teamsUsers.teamId, teamIds)).run();
    tx.delete(usersTeamsTeamRoles)
      .where(inArray(usersTeamsTeamRoles.teamId, teamIds))
      .run();
  }

  private deleteTrackedOrganizationChildren(
    tx: SeedDatabase,
    organizationIds: readonly number[],
  ): void {
    if (organizationIds.length === 0) {
      return;
    }

    tx.delete(projectsOrganizations)
      .where(inArray(projectsOrganizations.organizationId, organizationIds))
      .run();
    tx.delete(organizationsTeams)
      .where(inArray(organizationsTeams.organizationId, organizationIds))
      .run();
    tx.delete(usersOrganizationsOrganizationRoles)
      .where(
        inArray(usersOrganizationsOrganizationRoles.organizationId, organizationIds),
      )
      .run();
    tx.delete(usersOrganizations)
      .where(inArray(usersOrganizations.organizationId, organizationIds))
      .run();
  }

  private deleteTrackedUserChildren(
    tx: SeedDatabase,
    userIds: readonly number[],
  ): void {
    if (userIds.length === 0) {
      return;
    }

    const credentialIds = tx
      .select({ id: usersCredentialTypes.id })
      .from(usersCredentialTypes)
      .where(inArray(usersCredentialTypes.userId, userIds))
      .all()
      .map((row) => row.id);

    tx.delete(usersSessions).where(inArray(usersSessions.userId, userIds)).run();
    tx.delete(usersOrganizationsOrganizationRoles)
      .where(inArray(usersOrganizationsOrganizationRoles.userId, userIds))
      .run();
    tx.delete(usersOrganizations)
      .where(inArray(usersOrganizations.userId, userIds))
      .run();
    tx.delete(usersProjectsProjectRoles)
      .where(inArray(usersProjectsProjectRoles.userId, userIds))
      .run();
    tx.delete(projectsUsers).where(inArray(projectsUsers.userId, userIds)).run();
    tx.delete(usersTeamsTeamRoles)
      .where(inArray(usersTeamsTeamRoles.userId, userIds))
      .run();
    tx.delete(teamsUsers).where(inArray(teamsUsers.userId, userIds)).run();
    tx.delete(usersSystemRoles)
      .where(inArray(usersSystemRoles.userId, userIds))
      .run();

    if (credentialIds.length > 0) {
      tx.delete(usersPasswordCredentials)
        .where(inArray(usersPasswordCredentials.userCredentialTypeId, credentialIds))
        .run();
    }

    tx.delete(usersCredentialTypes)
      .where(inArray(usersCredentialTypes.userId, userIds))
      .run();
  }

  private deleteTrackedTopLevelEntities(
    tx: SeedDatabase,
    trackedIds: {
      organizationIds: readonly number[];
      projectIds: readonly number[];
      teamIds: readonly number[];
      userIds: readonly number[];
    },
  ): void {
    if (trackedIds.projectIds.length > 0) {
      tx.delete(projects).where(inArray(projects.id, trackedIds.projectIds)).run();
    }
    if (trackedIds.teamIds.length > 0) {
      tx.delete(teams).where(inArray(teams.id, trackedIds.teamIds)).run();
    }
    if (trackedIds.organizationIds.length > 0) {
      tx.delete(organizations)
        .where(inArray(organizations.id, trackedIds.organizationIds))
        .run();
    }
    if (trackedIds.userIds.length > 0) {
      tx.delete(users).where(inArray(users.id, trackedIds.userIds)).run();
    }
  }
}
