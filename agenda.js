import Agenda from "agenda";
import express from "express";
import { sendMessage } from "./wweb.js";

export const post_automations = express.Router();
export const agenda = new Agenda({
  db: { address: process.env.MONGODB_URI, collection: "post_automations" },
});
agenda.define("automate post", (job) => {
  const { clientId, groupId, postId } = job.attrs.data;
  sendMessage(clientId, groupId, postId);
});

(async function () {
  await agenda.start();
})();

post_automations.post("/", async (req, res) => {
  const { clientId, groupChats, id } = req.body.document;
  await Promise.all(
    groupChats.map((groupChat) => {
      return Promise.all([
        schedulePost(clientId, groupChat.id, id, `5/8 * * * *`), //8am
        // schedulePost(clientId, groupChat.id, id, `0 8 * * *`), //8am
        // schedulePost(clientId, groupChat.id, id, `0 15 * * *`), //3pm
      ]);
    })
  );
  return res.send("Scheduled successfully!");
});

async function schedulePost(clientId, groupId, postId, cron) {
  const jobId = Date.now().toString();
  const job = agenda.create("automate post", {
    jobId,
    clientId,
    postId,
    groupId,
  });

  job.unique({ "data.jobId": jobId });
  job.repeatEvery(cron, { timezone: "America/Toronto", skipImmediate: true });
  await job.save();
}
