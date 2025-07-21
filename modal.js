import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
  sessionId: String,
  sessionToken: {
    WABrowserId: String,
    WASecretBundle: String,
    WAToken1: String,
    WAToken2: String,
  },
});

export const Session =
  mongoose.models.Session || mongoose.model("Session", SessionSchema);
