import express from "express";
export const router = express.Router();
import wweb from "whatsapp-web.js";

const { Client, LocalAuth, MessageMedia } = wweb;
const map = new Map();

const client_server =
  process.env.NODE_ENV === "development"
    ? process.env.MY_AI_ASSISTANT_LOCAL
    : process.env.MY_AI_ASSISTANT_LIVE;

function getClient(clientId) {
  const client = new Client({
    puppeteer: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
    authStrategy: new LocalAuth({
      clientId,
    }),
  });
  return client;
}

router.get("/connect-to-whatsapp/:clientId", async (req, res) => {
  const { clientId } = req.params;
  try {
    const client = getClient(clientId);
    client.on("qr", (qr) => {
      return res.json({ qrImg: qr });
    });
    client.on("ready", async () => {
      console.log(`client is ready`);
      map.set(clientId, "client_ready");
    });
    client.on("authenticated", () => {
      console.log(`Client ${clientId} authenticated`);
      map.set(clientId, "client_authenticated");
    });

    client.initialize();
  } catch (error) {
    console.error("Failed to connect to WhatsApp:", error);
    return res.status(500).json({ error: "Failed to connect to WhatsApp" });
  }
});

router.get("/is-connected/:clientId", (req, res) => {
  const { clientId } = req.params;
  try {
    const clientStatus = map.has(clientId) ? map.get(clientId) : "";
    return res.json({ status: clientStatus });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch client status" });
  }
});

router.get("/client-status/:clientId", (req, res) => {
  const { clientId } = req.params;
  const client = getClient(clientId);
  client.on("qr", () => {
    console.log(`${clientId} has to scan qrcode`);
  });
  client.on("ready", () => {
    console.log(`${clientId} is ready to send messages`);
  });
  client.on("disconnected", (msg) => {
    console.log(`${clientId} is disconnected with message ${msg}`);
  });
  client.on("auth_failure", (msg) => {
    console.log(`${clientId} authentication failure with message ${msg}`);
  });
  client.on("authenticated", () => {
    console.log(`${clientId} is authenticated`);
  });
  client.initialize();
});

router.get("/all-groups/:clientId", async (req, res) => {
  const { clientId } = req.params;
  try {
    const client = getClient(clientId);
    client.on("ready", async () => {
      const chats = await client.getChats();
      const groupChats = await Promise.all(
        chats
          .filter((chat) => chat.isGroup)
          .map(async (groupChat) => ({
            id: groupChat.id._serialized,
            name: groupChat.name,
            profilePicture: await client.getProfilePicUrl(
              groupChat.id._serialized
            ),
          }))
      );
      // console.log("Group chats:", groupChats);
      return res.json({ groupChats });
    });

    client.on("qr", (qr) => {
      console.log("scan qrcode again");
    });
    client.on("authenticated", () => {
      console.log(`Client ${clientId} authenticated`);
    });
    client.initialize();
  } catch (error) {
    console.error("Error occurred:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching group chats." });
  }
});

export async function sendMessage(postId) {
  const post = await (
    await fetch(`${client_server}/api/posts/${postId}`)
  ).json();
  const client = getClient(post.clientId);
  client.on("qr", (qr) => {
    console.log("scan qrcode again");
  });
  client.on("ready", async () => {
    if (post.images.length > 0) {
      const mediaArray = await Promise.all(
        post.images.map((url) => MessageMedia.fromUrl(url))
      );

      for (const groupChat of post.groupChats) {
        // Send first image with caption
        await client.sendMessage(groupChat.id, mediaArray[0], {
          caption: post.description,
        });

        // Send remaining images without caption
        for (let i = 1; i < mediaArray.length; i++) {
          await client.sendMessage(groupChat.id, mediaArray[i]);
        }
      }
    } else {
      for (const groupChat of post.groupChats) {
        await client.sendMessage(groupChat.id, post.description);
      }
    }
  });
  client.initialize();
}
