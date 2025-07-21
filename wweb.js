import express from "express";
import wppconnect from "@wppconnect-team/wppconnect";
import { Session } from "./modal.js";
import mongoose from "mongoose";

export const router = express.Router();

const status = new Map();

router.get("/create_session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    await mongoose.connect(process.env.MONGODB_URI);
    wppconnect
      .create({
        session: sessionId,
        catchQR: (base64Qrimg) => {
          return res.json({ qrImg: base64Qrimg });
        },
        statusFind: (statusSession, session) => {
          status.set(session, statusSession);
        },
      })
      .then(async (client) => {
        const sessionToken = await client.getSessionTokenBrowser();
        await Session.updateOne(
          { sessionId },
          { $set: { sessionToken } },
          { upsert: true }
        );
        status.set(sessionId, "session_created");
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.get("/client_status/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  try {
    const clientStatus = status.has(sessionId) ? status.get(sessionId) : "";
    return res.json({ status: clientStatus });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch client status" });
  }
});

router.get(
  "/all_whatsapp_groups_client_is_part_of/:sessionId",
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      await mongoose.connect(process.env.MONGODB_URI);
      const existing = await Session.findOne({ sessionId });
      const sessionToken = existing?.sessionToken;
      wppconnect
        .create({
          session: sessionId,
          sessionToken,
          catchQR: () => {
            return res.json({ status: "you have to re-authenticate" });
          },
          statusFind: (statusSession, session) => {
            console.log({ statusSession, session });
          },
        })
        .then(async (client) => {
          const groupChats = await client.listChats({ onlyGroups: true });

          const enrichedGroupChats = await Promise.all(
            groupChats.map(async (groupChat) => {
              const chat = {
                id: groupChat.id._serialized,
                name: groupChat.name,
              };
              const profilePic = await client.getProfilePicFromServer(chat.id);
              chat.profilePicture = profilePic.img;
              return chat;
            })
          );
          return res.json({ groupChats: enrichedGroupChats });
        });
    } catch (error) {
      console.error("Error occurred:", error);
      return res
        .status(500)
        .json({ error: "An error occurred while fetching group chats." });
    }
  }
);

export async function sendMessage(clientId, groupIds, postId) {
  const url =
    process.env.NODE_ENV === "development"
      ? process.env.MY_AI_ASSISTANT_LOCAL
      : process.env.MY_AI_ASSISTANT_LIVE;
  const req = await fetch(`${url}/api/posts/${postId}`);
  const post = await req.json();
  await mongoose.connect(process.env.MONGODB_URI);
  const existing = await Session.findOne({ sessionId: clientId });
  const sessionToken = existing?.sessionToken;
  wppconnect
    .create({
      session: clientId,
      sessionToken,
      statusFind: (statusSession, session) => {
        console.log({ statusSession, session });
      },
    })
    .then(async (client) => {
      // Send messages to all groups in parallel
      const sendMessagesPromises = groupIds.map((groupId) => {
        if (post.images.length == 0) {
          client
            .sendText(groupId, post.description)
            .then((result) => {
              console.log(`Message sent to group ${groupId}:`);
            })
            .catch((error) => {
              console.error(
                `Failed to send message to group ${groupId}:`,
                error
              );
            });
        } else {
          client
            .sendImage(groupId, post.images[9], "post", post.description)
            .then((result) => {
              console.log(`Message sent to group ${groupId}:`);
            })
            .catch((error) => {
              console.error(
                `Failed to send message to group ${groupId}:`,
                error
              );
            });
        }
      });
      // Wait for all messages to be sent
      await Promise.all(sendMessagesPromises);
    })
    .catch((error) => {
      console.error("Failed to create WhatsApp client:", error);
    });
}
