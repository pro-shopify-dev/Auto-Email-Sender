const { MongoClient } = require("mongodb");

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "gmail_automation");
  const users = await db.collection("users").find({}).project({ _id: 1, email: 1 }).toArray();

  for (const user of users) {
    const byUser = { userId: user._id };
    const connections = await db
      .collection("gmailConnections")
      .find(byUser)
      .project({ gmailAddress: 1, status: 1, enabled: 1 })
      .toArray();
    const templates = await db.collection("templates").countDocuments(byUser);
    const contacts = await db.collection("contacts").countDocuments(byUser);
    const fresh = await db.collection("contacts").countDocuments({
      ...byUser,
      emailStatus: "active",
      $or: [{ lastEmailedAt: null }, { lastEmailedAt: { $exists: false } }],
      $and: [
        { $or: [{ draftReservedAt: null }, { draftReservedAt: { $exists: false } }] },
      ],
    });
    const drafts = await db.collection("gmailDrafts").countDocuments(byUser);

    console.log(JSON.stringify({
      user: user.email,
      connections: connections.map((connection) => ({
        gmail: connection.gmailAddress,
        status: connection.status,
        enabled: connection.enabled,
      })),
      templates,
      contacts,
      fresh,
      drafts,
    }));
  }

  await client.close();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
