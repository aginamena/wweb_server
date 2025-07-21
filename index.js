import Agendash from "agendash";
import bodyParser from "body-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { agenda, post_automations } from "./agenda.js";
import { router } from "./wweb.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

app.use("/", router);
app.use("/schedule", post_automations);
app.use("/dash", Agendash(agenda));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
