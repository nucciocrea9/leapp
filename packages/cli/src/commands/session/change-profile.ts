import { AwsSessionService } from "@noovolari/leapp-core/services/session/aws/aws-session-service";
import { LeappCommand } from "../../leapp-command";
import { Config } from "@oclif/core/lib/config/config";
import { Session } from "@noovolari/leapp-core/models/session";
import { profileId, sessionId } from "../../flags";

export default class ChangeSessionProfile extends LeappCommand {
  static description = "Change a session named-profile";

  static examples = [`$leapp session change-profile`, `$leapp session change-profile --profileId PROFILEID --sessionId SESSIONID`];

  static flags = {
    sessionId,
    profileId,
  };

  constructor(argv: string[], config: Config) {
    super(argv, config);
  }

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(ChangeSessionProfile);
      if (flags.profileId && flags.profileId !== "" && flags.sessionId && flags.sessionId !== "") {
        const selectedSession = this.cliProviderService.repository.getSessionById(flags.sessionId);
        const selectedProfile = this.cliProviderService.repository.getProfiles().find((p) => p.id === flags.profileId);
        if (!selectedSession) {
          throw new Error("Session not found with id " + flags.sessionId);
        }
        if (!selectedProfile) {
          throw new Error("Profile not found with id " + flags.profileId);
        }
        await this.changeSessionProfile(selectedSession, flags.profileId);
      } else {
        const selectedSession = await this.selectSession();
        const selectedProfile = await this.selectProfile(selectedSession);
        await this.changeSessionProfile(selectedSession, selectedProfile);
      }
    } catch (error) {
      this.error(error instanceof Error ? error.message : `Unknown error: ${error}`);
    }
  }

  async selectSession(): Promise<Session> {
    const availableSessions = this.cliProviderService.repository
      .getSessions()
      .filter((session) => this.cliProviderService.sessionFactory.getSessionService(session.type) instanceof AwsSessionService);

    const answer: any = await this.cliProviderService.inquirer.prompt([
      {
        name: "selectedSession",
        message: "select a session",
        type: "list",
        choices: availableSessions.map((session) => ({ name: session.sessionName, value: session })),
      },
    ]);
    return answer.selectedSession;
  }

  async selectProfile(session: Session): Promise<string> {
    const currentProfileName = this.cliProviderService.repository.getProfileName((session as any).profileId);
    const availableProfiles = this.cliProviderService.repository.getProfiles().filter((profile) => profile.id !== (session as any).profileId);

    if (availableProfiles.length === 0) {
      throw new Error("no profiles available");
    }

    const answer: any = await this.cliProviderService.inquirer.prompt([
      {
        name: "selectedProfile",
        message: `current profile is ${currentProfileName}, select a new profile`,
        type: "list",
        choices: availableProfiles.map((profile) => ({ name: profile.name, value: profile.id })),
      },
    ]);
    return answer.selectedProfile;
  }

  async changeSessionProfile(session: Session, newProfileId: string): Promise<void> {
    try {
      await this.cliProviderService.namedProfilesService.changeNamedProfile(session, newProfileId);
      this.log("session profile changed");
    } finally {
      await this.cliProviderService.remoteProceduresClient.refreshSessions();
    }
  }
}
