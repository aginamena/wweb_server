import Agenda from "agenda";
import express from "express";
import { sendMessage } from "./wweb.js";

export const post_automations = express.Router();
export const agenda = new Agenda({
  db: { address: process.env.MONGODB_URI, collection: "post_automations" },
});
agenda.define("automate post", (job) => {
  const { postId } = job.attrs.data;
  sendMessage(postId);
});

(async function () {
  await agenda.start();
})();

post_automations.post("/", async (req, res) => {
  const { postId, morningHours, eveningHours } = req.body;
  await Promise.all([
    schedulePost(postId, morningHours),
    schedulePost(postId, eveningHours),
  ]);
  return res.send("Scheduled successfully!");
});

async function schedulePost(postId, time) {
  const jobId = Date.now().toString();
  const job = agenda.create("automate post", {
    jobId,
    postId,
    time,
  });
  job.unique({ "data.jobId": jobId });
  job.repeatEvery(time, { timezone: "America/Toronto", skipImmediate: true });
  await job.save();
}
