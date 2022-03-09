import { jest, describe, test, expect } from "@jest/globals";
import SyncIntegration from "./sync";

describe("SyncIntegration", () => {
  const getTestCommand = (leappCliService: any = null, argv: string[] = []): SyncIntegration => {
    const command = new SyncIntegration(argv, {} as any);
    (command as any).leappCliService = leappCliService;
    return command;
  };

  test("selectIntegration", async () => {
    const integration = { alias: "integration1" };
    const leappCliService: any = {
      awsSsoIntegrationService: {
        getOnlineIntegrations: jest.fn(() => [integration]),
      },
      inquirer: {
        prompt: async (params: any) => {
          expect(params).toEqual([
            {
              name: "selectedIntegration",
              message: "select an integration",
              type: "list",
              choices: [{ name: integration.alias, value: integration }],
            },
          ]);
          return { selectedIntegration: integration };
        },
      },
    };

    const command = getTestCommand(leappCliService);
    const selectedIntegration = await command.selectIntegration();

    expect(leappCliService.awsSsoIntegrationService.getOnlineIntegrations).toHaveBeenCalled();
    expect(selectedIntegration).toBe(integration);
  });

  test("selectIntegration, no integrations", async () => {
    const leappCliService: any = {
      awsSsoIntegrationService: {
        getOnlineIntegrations: jest.fn(() => []),
      },
    };

    const command = getTestCommand(leappCliService);
    await expect(command.selectIntegration()).rejects.toThrow(new Error("no online integrations available"));
  });

  test("sync", async () => {
    const sessionsSynced = ["session1", "session2"];
    const leappCliService: any = {
      awsSsoIntegrationService: {
        syncSessions: jest.fn(async () => sessionsSynced),
      },
    };

    const command = getTestCommand(leappCliService);
    command.log = jest.fn();

    const integration = { id: "id1" } as any;
    await command.sync(integration);

    expect(leappCliService.awsSsoIntegrationService.syncSessions).toHaveBeenCalledWith(integration.id);
    expect(command.log).toHaveBeenCalledWith(`${sessionsSynced.length} sessions synchronized`);
  });

  const runCommand = async (errorToThrow: any, expectedErrorMessage: string) => {
    const selectedIntegration = { id: "1" };

    const command = getTestCommand();
    command.selectIntegration = jest.fn(async (): Promise<any> => selectedIntegration);
    command.sync = jest.fn(async () => {
      if (errorToThrow) {
        throw errorToThrow;
      }
    });

    let occurredError;
    try {
      await command.run();
    } catch (error) {
      occurredError = error;
    }

    expect(command.selectIntegration).toHaveBeenCalled();
    expect(command.sync).toHaveBeenCalledWith(selectedIntegration);
    if (errorToThrow) {
      expect(occurredError).toEqual(new Error(expectedErrorMessage));
    }
  };

  test("run", async () => {
    await runCommand(undefined, "");
  });

  test("run - sync throws exception", async () => {
    await runCommand(new Error("errorMessage"), "errorMessage");
  });

  test("run - sync throws undefined object", async () => {
    await runCommand({ hello: "randomObj" }, "Unknown error: [object Object]");
  });
});
