import { Plugin, Permissions, Command, Config } from "mattermost-plugin-api";

export default class DeleteOldAttachmentsPlugin extends Plugin {
  constructor() {
    super();

    this.registerCommand(
      new Command({
        name: "delete-old-attachments",
        description: "Deletes old attachments",
        options: [
          {
            name: "days",
            description: "The number of days to keep attachments for",
            type: Number,
            required: true,
          },
        ],
        run: async (args, context) => {
          // Check if the user has permission to delete attachments
          if (!context.user.hasPermission(Permissions.MANAGE_SYSTEM)) {
            throw new Error("You do not have permission to delete attachments");
          }

          // Get the list of attachments to delete
          const attachments = await context.api.listAttachments({
            before: new Date().getTime() - (args.days * 24 * 60 * 60 * 1000),
          });

          // Delete the attachments
          const deletedAttachments = await Promise.all(attachments.map(async attachment => {
            await context.api.deleteAttachment(attachment.id);
            return attachment;
          }));

          // Generate a detailed report
          const report = {
            attachments: deletedAttachments,
            totalSize: deletedAttachments.reduce((sum, attachment) => sum + attachment.size, 0),
          };

          // Success message
          context.reply("Attachments deleted successfully");
          context.reply(JSON.stringify(report, null, 2));
        },
      }),
    );

    this.registerConfig({
      name: "delete-old-attachments",
      description: "Configures the automatic deletion of old attachments",
      type: Config.Type.object,
      options: [
        {
          name: "enabled",
          description: "Whether the automatic deletion of old attachments is enabled",
          type: Config.Type.boolean,
          default: false,
        },
        {
          name: "days",
          description: "The number of days to keep attachments for",
          type: Config.Type.number,
          default: 365,
        },
        {
          name: "interval",
          description: "The interval to run the cleanup job",
          type: Config.Type.string,
          default: "daily",
          values: ["daily", "weekly"],
        },
        {
          name: "startHour",
          description: "The hour of the day to start the cleanup job",
          type: Config.Type.number,
          default: 0,
          min: 0,
          max: 23,
        },
        {
          name: "startDay",
          description: "The day of the week to start the cleanup job",
          type: Config.Type.string,
          default: "monday",
          values: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        },
      ],
    });

    this.onStart(context) {
      // Get the configuration
      const config = context.config.get("delete-old-attachments");

      // Schedule a task to delete old attachments
      if (config.enabled) {
        context.scheduler.scheduleJob(
          "delete-old-attachments",
          config.interval,
          async () => {
            // Get the list of attachments to delete
            const attachments = await context.api.listAttachments({
              before: new Date().getTime() - (config.days * 24 * 60 * 60 * 1000),
            });

            // Delete the attachments
            await Promise.all(attachments.map(async attachment => {
              await context.api.deleteAttachment(attachment.id);
            }));
          },
          config.startHour,
		      config.startDay,
		      { cancelled: !config.enabled },
        );
      }

      // Monitor the configuration for changes
      context.config.onConfigChanged(this.onConfigChanged);
    }

    onConfigChanged = (oldConfig, newConfig) => {
      // Get the new configuration
      const config = newConfig.get("delete-old-attachments");

      // Update the scheduler job
      if (config.enabled) {
        context.scheduler.updateJob(
          "delete-old-attachments",
          config.interval,
          config.startHour,
		      config.startDay,
        );
      } else {
        context.scheduler.cancelJob("delete-old-attachments");
      }
    };
  }
}
